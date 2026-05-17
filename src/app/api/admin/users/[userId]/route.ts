import { NextResponse } from "next/server"
import { z } from "zod"

import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
})

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
    const parsed = updateUserSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid data" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { name: parsed.data.name },
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
          action: `Updated user name to "${parsed.data.name}"`,
          entityType: "User",
          entityId: userId,
        },
      })
    } catch {
      // audit log failure is non-fatal
    }

    return NextResponse.json({ success: true, message: "User updated" })
  } catch (error) {
    console.error("User update failed", error)
    return NextResponse.json({ success: false, message: "Unable to update user" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email || !canAccessAdminScope(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { userId } = await params

    // Prevent self-deletion
    const actor = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    })

    if (actor?.id === userId) {
      return NextResponse.json(
        { success: false, message: "You cannot delete your own account." },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        vendorProfile: {
          include: {
            subscription: {
              select: { stripeSubscriptionId: true },
            },
            _count: {
              select: {
                transactions: {
                  where: {
                    status: {
                      notIn: ["COMPLETED", "CANCELLED"],
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
    }

    // Block deletion if vendor has open transactions
    if (user.vendorProfile && user.vendorProfile._count.transactions > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `This vendor has ${user.vendorProfile._count.transactions} active transaction(s). Complete or cancel them before deleting the account.`,
        },
        { status: 409 }
      )
    }

    const stripeSubscriptionId = user.vendorProfile?.subscription?.stripeSubscriptionId
    let stripeCancelled = false

    if (stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(stripeSubscriptionId)
        stripeCancelled = true
      } catch (stripeError) {
        console.error("Stripe subscription cancellation failed during account deletion", stripeError)
      }
    }

    await prisma.user.delete({ where: { id: userId } })

    try {
      const auditAction = stripeSubscriptionId
        ? `Deleted user account (${user.email}) — Stripe subscription ${stripeCancelled ? "cancelled" : "cancellation failed"}: ${stripeSubscriptionId}`
        : `Deleted user account (${user.email})`

      await prisma.auditLog.create({
        data: {
          actorId: actor?.id,
          actorType: session.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
          action: auditAction,
          entityType: "User",
          entityId: userId,
        },
      })
    } catch {
      // audit log failure is non-fatal
    }

    return NextResponse.json({ success: true, message: "User account deleted" })
  } catch (error) {
    console.error("User deletion failed", error)
    return NextResponse.json({ success: false, message: "Unable to delete user" }, { status: 500 })
  }
}
