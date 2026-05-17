import { NextResponse } from "next/server"

import {
  destroyVendorProfileLogoAssetIfOwnedByVendor,
  normalizeVendorProfileLogoImage,
} from "@/features/dashboard/server/vendor-profile-logo-assets"
import { vendorProfileSchema } from "@/features/dashboard/schemas/vendor-profile.schema"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { sendAdminVendorProfileSubmittedEmail } from "@/lib/integrations/resend"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsedBody = vendorProfileSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid profile details" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      include: { vendorProfile: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
    }

    if (!user.vendorProfile) {
      return NextResponse.json({ success: false, message: "Vendor profile not found" }, { status: 404 })
    }

    const vendorProfile = user.vendorProfile as typeof user.vendorProfile & {
      businessLogoUrl?: string | null
      businessLogoPublicId?: string | null
      businessLogoFileName?: string | null
    }

    let normalizedLogo: ReturnType<typeof normalizeVendorProfileLogoImage>

    try {
      normalizedLogo = normalizeVendorProfileLogoImage(
        {
          businessLogoUrl: typeof body?.businessLogoUrl === "string" ? body.businessLogoUrl : null,
          businessLogoPublicId: typeof body?.businessLogoPublicId === "string" ? body.businessLogoPublicId : null,
          businessLogoFileName: typeof body?.businessLogoFileName === "string" ? body.businessLogoFileName : null,
        },
        vendorProfile.id
      )
    } catch (logoError) {
      return NextResponse.json(
        {
          success: false,
          message: logoError instanceof Error ? logoError.message : "Invalid logo data",
        },
        { status: 400 }
      )
    }

    const {
      ownerFirstName,
      ownerLastName,
      businessName,
      supportEmail,
      businessPhone,
      businessAddress,
      businessCountry,
      registrationNumber,
      vatNumber,
      preferredLocale,
    } =
      parsedBody.data
    const accountEmail = session.user.email.toLowerCase()
    const fullName = `${ownerFirstName} ${ownerLastName}`.trim()
    const previousLogoUrl = vendorProfile.businessLogoUrl
    const previousLogoFileName = vendorProfile.businessLogoFileName

    const nextSlugBase = slugify(businessName)
    const nextSlug = vendorProfile.businessSlug ?? `${nextSlugBase || "business"}-${user.id.slice(-6)}`
    const vendorProfileLogoData = {
      businessLogoUrl: normalizedLogo.businessLogoUrl,
      businessLogoPublicId: normalizedLogo.businessLogoPublicId,
      businessLogoFileName: normalizedLogo.businessLogoFileName,
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: fullName,
        vendorProfile: {
          upsert: {
            create: {
              ownerFirstName,
              ownerLastName,
              businessName,
              businessEmail: accountEmail,
              supportEmail: supportEmail ? supportEmail.toLowerCase() : null,
              businessPhone,
              businessAddress,
              businessCountry,
              registrationNumber,
              vatNumber: vatNumber ? vatNumber : null,
              ...vendorProfileLogoData,
              preferredLocale,
              businessSlug: nextSlug,
            },
            update: {
              ownerFirstName,
              ownerLastName,
              businessName,
              businessEmail: accountEmail,
              supportEmail: supportEmail ? supportEmail.toLowerCase() : null,
              businessPhone,
              businessAddress,
              businessCountry,
              registrationNumber,
              vatNumber: vatNumber ? vatNumber : null,
              ...vendorProfileLogoData,
              preferredLocale,
              businessSlug: nextSlug,
            },
          },
        },
      },
    })

    if (previousLogoUrl !== normalizedLogo.businessLogoUrl) {
      try {
        await destroyVendorProfileLogoAssetIfOwnedByVendor(previousLogoUrl, vendorProfile.id, previousLogoFileName)
      } catch (cleanupError) {
        console.error("Previous vendor logo cleanup skipped", cleanupError)
      }
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorType: "USER",
          action: "Updated vendor profile",
          entityType: "VendorProfile",
          entityId: vendorProfile.id,
        },
      })
    } catch (auditError) {
      console.error("Audit log write skipped", auditError)
    }

    // Notify superadmin when profile is pending review
    if (vendorProfile.reviewStatus === "PENDING") {
      try {
        const isFirst = !vendorProfile.businessName
        await sendAdminVendorProfileSubmittedEmail(
          env.SUPER_ADMIN_EMAIL,
          businessName,
          accountEmail,
          user.id,
          isFirst
        )
      } catch (emailError) {
        console.error("Admin profile notification skipped", emailError)
      }
    }

    return NextResponse.json({ success: true, message: "Profile updated" })
  } catch (error) {
    console.error("Vendor profile update failed", error)
    return NextResponse.json(
      {
        success: false,
        message: "Unable to update business profile",
      },
      { status: 500 }
    )
  }
}
