import { NextResponse } from "next/server"
import { z } from "zod"

import { USER_ROLES } from "@/lib/auth/roles"
import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

const roleSchema = z.object({
  role: z.enum([USER_ROLES.VENDOR, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN, USER_ROLES.CLIENT]),
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
    const parsed = roleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid role" },
        { status: 400 }
      )
    }

    // Only SUPER_ADMIN can grant SUPER_ADMIN role
    if (parsed.data.role === USER_ROLES.SUPER_ADMIN && session.user.role !== USER_ROLES.SUPER_ADMIN) {
      return NextResponse.json(
        { success: false, message: "Only a Super Admin can grant Super Admin access." },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
    }

    // Prevent demoting the only SUPER_ADMIN
    if (user.role === USER_ROLES.SUPER_ADMIN && parsed.data.role !== USER_ROLES.SUPER_ADMIN) {
      const superAdminCount = await prisma.user.count({
        where: { role: USER_ROLES.SUPER_ADMIN },
      })

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { success: false, message: "Cannot change the role of the only Super Admin account." },
          { status: 400 }
        )
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: parsed.data.role },
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
          action: `Changed user role from ${user.role} to ${parsed.data.role}`,
          entityType: "User",
          entityId: userId,
        },
      })
    } catch {
      // audit log failure is non-fatal
    }

    return NextResponse.json({ success: true, message: `Role updated to ${parsed.data.role}` })
  } catch (error) {
    console.error("Role update failed", error)
    return NextResponse.json({ success: false, message: "Unable to update role" }, { status: 500 })
  }
}
