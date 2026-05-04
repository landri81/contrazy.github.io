import { NextResponse } from "next/server"

import { vendorProfileSchema } from "@/features/dashboard/schemas/vendor-profile.schema"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

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

    const { fullName, businessName, supportEmail, businessPhone, businessAddress, businessCountry } =
      parsedBody.data
    const accountEmail = session.user.email.toLowerCase()

    const nextSlugBase = slugify(businessName)
    const nextSlug = user.vendorProfile?.businessSlug ?? `${nextSlugBase || "business"}-${user.id.slice(-6)}`

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: fullName,
        vendorProfile: {
          upsert: {
            create: {
              businessName,
              businessEmail: accountEmail,
              supportEmail: supportEmail ? supportEmail.toLowerCase() : null,
              businessPhone,
              businessAddress,
              businessCountry,
              businessSlug: nextSlug,
            },
            update: {
              businessName,
              businessEmail: accountEmail,
              supportEmail: supportEmail ? supportEmail.toLowerCase() : null,
              businessPhone,
              businessAddress,
              businessCountry,
              businessSlug: nextSlug,
            },
          },
        },
      },
    })

    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          actorType: "USER",
          action: "Updated vendor profile",
          entityType: "VendorProfile",
          entityId: user.vendorProfile?.id,
        },
      })
    } catch (auditError) {
      console.error("Audit log write skipped", auditError)
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
