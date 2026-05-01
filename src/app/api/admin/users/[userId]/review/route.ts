import { NextResponse } from "next/server"

import { vendorReviewSchema } from "@/features/dashboard/schemas/vendor-profile.schema"
import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

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
    const parsedBody = vendorReviewSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid review status" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vendorProfile: true },
    })

    if (!user?.vendorProfile) {
      return NextResponse.json({ success: false, message: "Vendor account not found" }, { status: 404 })
    }

    await prisma.vendorProfile.update({
      where: { id: user.vendorProfile.id },
      data: {
        reviewStatus: parsedBody.data.reviewStatus,
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
          action: `Set vendor review status to ${parsedBody.data.reviewStatus}`,
          entityType: "VendorProfile",
          entityId: user.vendorProfile.id,
        },
      })
    } catch (auditError) {
      console.error("Audit log write skipped", auditError)
    }

    return NextResponse.json({ success: true, message: "Review status updated" })
  } catch (error) {
    console.error("Vendor review update failed", error)
    return NextResponse.json(
      {
        success: false,
        message: "Unable to update review status",
      },
      { status: 500 }
    )
  }
}
