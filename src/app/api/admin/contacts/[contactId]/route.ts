import { NextResponse } from "next/server"
import { z } from "zod"
import { AuditActorType, UserRole } from "@prisma/client"

import { canAccessAdminScope, isSuperAdminEmail } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { sendContactReply } from "@/lib/integrations/resend"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { requiredText } from "@/lib/validation/text-schemas"

export const runtime = "nodejs"

const replySchema = z.object({
  action: z.enum(["mark_read", "reply", "archive"]),
  replyText: requiredText("Reply", INPUT_LIMITS.contactReply).optional(),
})

async function resolveAdminActorUser(
  session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>
) {
  const email = session.user.email?.toLowerCase()
  if (!email) return null

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return existing

  if (session.user.role !== "SUPER_ADMIN" || !isSuperAdminEmail(email, env.SUPER_ADMIN_EMAIL)) {
    return null
  }

  return prisma.user.upsert({
    where: { email },
    update: { name: session.user.name ?? "Super Admin", role: UserRole.SUPER_ADMIN },
    create: { email, name: session.user.name ?? "Super Admin", role: UserRole.SUPER_ADMIN },
    select: { id: true },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email || !canAccessAdminScope(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { contactId } = await params
    const body = await request.json()
    const parsed = replySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const { action, replyText } = parsed.data

    const contact = await prisma.contactMessage.findUnique({ where: { id: contactId } })
    if (!contact) {
      return NextResponse.json({ success: false, message: "Message not found" }, { status: 404 })
    }

    const adminUser = await resolveAdminActorUser(session)
    const actorType =
      session.user.role === "SUPER_ADMIN" ? AuditActorType.SUPER_ADMIN : AuditActorType.USER

    if (action === "mark_read") {
      if (contact.status === "NEW") {
        await prisma.contactMessage.update({
          where: { id: contactId },
          data: { status: "READ" },
        })
      }
      return NextResponse.json({ success: true })
    }

    if (action === "archive") {
      await prisma.contactMessage.update({
        where: { id: contactId },
        data: { status: "ARCHIVED" },
      })

      try {
        await prisma.auditLog.create({
          data: {
            actorId: adminUser?.id,
            actorType,
            action: "Archived contact message",
            entityType: "ContactMessage",
            entityId: contactId,
          },
        })
      } catch { /* non-blocking */ }

      return NextResponse.json({ success: true })
    }

    if (action === "reply") {
      if (!replyText) {
        return NextResponse.json({ success: false, message: "Reply text is required" }, { status: 400 })
      }

      await prisma.contactMessage.update({
        where: { id: contactId },
        data: {
          status: "REPLIED",
          replyText,
          repliedAt: new Date(),
        },
      })

      await sendContactReply(
        contact.email,
        contact.firstName,
        replyText,
        contact.message,
        contact.locale
      )

      try {
        await prisma.auditLog.create({
          data: {
            actorId: adminUser?.id,
            actorType,
            action: "Replied to contact message",
            entityType: "ContactMessage",
            entityId: contactId,
            metadata: { recipientEmail: contact.email },
          },
        })
      } catch { /* non-blocking */ }

      return NextResponse.json({ success: true, message: "Reply sent successfully" })
    }

    return NextResponse.json({ success: false, message: "Unknown action" }, { status: 400 })
  } catch (error) {
    console.error("Admin contact action error:", error)
    return NextResponse.json({ success: false, message: "Failed to process action" }, { status: 500 })
  }
}
