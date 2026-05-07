import { NextResponse } from "next/server"

import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { vendorProfileSchema } from "@/features/dashboard/schemas/vendor-profile.schema"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email || !canAccessAdminScope(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { userId } = await params
    const body = await request.json()
    const parsedBody = vendorProfileSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid vendor profile data" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true },
    })

    if (!user?.vendorProfile) {
      return NextResponse.json({ success: false, message: "Vendor profile not found" }, { status: 404 })
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
    } = parsedBody.data
    const fullName = `${ownerFirstName} ${ownerLastName}`.trim()

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: fullName,
        vendorProfile: {
          update: {
            ownerFirstName,
            ownerLastName,
            businessName,
            supportEmail: supportEmail ? supportEmail.toLowerCase() : null,
            businessPhone,
            businessAddress,
            businessCountry,
            registrationNumber,
            vatNumber: vatNumber ? vatNumber : null,
            preferredLocale,
          },
        },
      },
    })

    try {
      const actor = await prisma.user.findUnique({
        where: { email: session.user.email.toLowerCase() },
        select: { id: true },
      })

      await prisma.auditLog.create({
        data: {
          actorId: actor?.id,
          actorType: session.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
          action: "Updated vendor profile from admin workspace",
          entityType: "VendorProfile",
          entityId: user.vendorProfile.id,
        },
      })
    } catch {
      // audit log failure is non-fatal
    }

    return NextResponse.json({ success: true, message: "Vendor profile updated" })
  } catch (error) {
    console.error("Admin vendor profile update failed", error)
    return NextResponse.json(
      { success: false, message: "Unable to update vendor profile" },
      { status: 500 }
    )
  }
}
