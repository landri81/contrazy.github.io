import { NextResponse } from "next/server"
import { z } from "zod"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"
import { getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"
import {
  sendClientDisputeResolved,
  sendVendorDisputeResolved,
} from "@/lib/integrations/resend"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { optionalText } from "@/lib/validation/text-schemas"

export const runtime = "nodejs"
export const maxDuration = 60

type DisputeAction = "mark_under_review" | "resolve_vendor_wins" | "resolve_client_wins"

const disputeActionSchema = z.object({
  action: z.enum(["mark_under_review", "resolve_vendor_wins", "resolve_client_wins"]),
  resolution: optionalText("Resolution note", INPUT_LIMITS.adminDisputeResolution).optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ disputeId: string }> }
) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email || !canAccessAdminScope(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const { disputeId } = await params
    const body = await request.json()
    const parsedBody = disputeActionSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid action" },
        { status: 400 }
      )
    }

    const { action, resolution } = parsedBody.data as { action: DisputeAction; resolution?: string }

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        transaction: {
          include: {
            vendor: true,
            clientProfile: true,
            depositAuthorization: true,
          },
        },
      },
    })

    if (!dispute) {
      return NextResponse.json({ success: false, message: "Dispute not found" }, { status: 404 })
    }

    if (dispute.status === "RESOLVED" || dispute.status === "LOST") {
      return NextResponse.json({ success: false, message: "Dispute is already resolved" }, { status: 409 })
    }

    const tx = dispute.transaction
    const depositAuth = tx.depositAuthorization
    const adminUser = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    })

    // ── Mark under review ────────────────────────────────────────────────────
    if (action === "mark_under_review") {
      await prisma.dispute.update({
        where: { id: disputeId },
        data: { status: "UNDER_REVIEW" },
      })

      try {
        await recordTransactionEvent(prisma, {
          transactionId: tx.id,
          type: "DISPUTE_OPENED",
          title: "Dispute under review",
          detail: "Admin has started reviewing the dispute.",
          dedupeKey: `event:dispute-review:${disputeId}`,
        })
      } catch { /* non-blocking */ }

      try {
        await prisma.auditLog.create({
          data: {
            actorId: adminUser?.id,
            actorType: session.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
            action: "Marked dispute as under review",
            entityType: "Dispute",
            entityId: disputeId,
          },
        })
      } catch { /* non-blocking */ }

      return NextResponse.json({ success: true })
    }

    if (!depositAuth || depositAuth.status !== "AUTHORIZED") {
      return NextResponse.json({ success: false, message: "Deposit is not in an authorized state" }, { status: 400 })
    }

    const now = new Date()
    const resolutionText = resolution || ""

    // ── Vendor wins: admin upholds claim — return deposit control to vendor ───
    // Stripe is NOT touched. Deposit stays AUTHORIZED so vendor can choose
    // full capture, partial capture, or release from their own dashboard.
    if (action === "resolve_vendor_wins") {
      await prisma.$transaction(async (txClient) => {
        await txClient.dispute.update({
          where: { id: disputeId },
          data: {
            status: "RESOLVED",
            resolution: resolutionText || null,
            resolvedByAdminId: adminUser?.id ?? null,
            resolvedAt: now,
          },
        })

        await txClient.transaction.update({
          where: { id: tx.id },
          data: { status: "COMPLETED" },
        })
      })

      try {
        await recordTransactionEvent(prisma, {
          transactionId: tx.id,
          type: "DISPUTE_OPENED",
          title: "Dispute resolved — vendor's claim upheld",
          detail: resolutionText || "Admin ruled in vendor's favour. Deposit control returned to vendor.",
          dedupeKey: `event:dispute-resolved:${disputeId}`,
        })
      } catch { /* non-blocking */ }

      try {
        await prisma.auditLog.create({
          data: {
            actorId: adminUser?.id,
            actorType: session.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
            action: "Resolved dispute: vendor wins — deposit control returned to vendor",
            entityType: "Dispute",
            entityId: disputeId,
            metadata: { resolution: resolutionText || null },
          },
        })
      } catch { /* non-blocking */ }

      if (tx.vendor?.businessEmail) {
        try {
          await sendVendorDisputeResolved(
            tx.vendor.businessEmail,
            tx.vendor.businessName ?? "Vendor",
            tx.clientProfile?.fullName ?? "the client",
            "vendor_wins",
            resolutionText
          )
        } catch { /* non-blocking */ }
      }

      if (tx.clientProfile?.email) {
        try {
          await sendClientDisputeResolved(
            tx.clientProfile.email,
            tx.clientProfile.fullName,
            tx.vendor?.businessName ?? "the vendor",
            "vendor_wins",
            resolutionText
          )
        } catch { /* non-blocking */ }
      }

      return NextResponse.json({ success: true, message: "Vendor's claim upheld — deposit control returned" })
    }

    // ── Client wins: admin releases deposit immediately ───────────────────────
    if (!depositAuth.stripeIntentId) {
      return NextResponse.json({ success: false, message: "No active Stripe deposit found" }, { status: 400 })
    }

    const stripeOpts = getConnectedAccountRequestOptions(tx.vendor?.stripeAccountId)
    await stripe.paymentIntents.cancel(depositAuth.stripeIntentId, {}, stripeOpts)

    await prisma.$transaction(async (txClient) => {
      await txClient.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: { status: "RELEASED", releasedAt: now },
      })

      await txClient.dispute.update({
        where: { id: disputeId },
        data: {
          status: "LOST",
          resolution: resolutionText || null,
          resolvedByAdminId: adminUser?.id ?? null,
          resolvedAt: now,
        },
      })

      await txClient.transaction.update({
        where: { id: tx.id },
        data: { status: "COMPLETED" },
      })
    })

    try {
      await recordTransactionEvent(prisma, {
        transactionId: tx.id,
        type: "DEPOSIT_RELEASED",
        title: "Dispute resolved — deposit released to client",
        detail: resolutionText || "Admin ruled in client's favour. Deposit hold released.",
        dedupeKey: `event:dispute-resolved:${disputeId}`,
      })
    } catch { /* non-blocking */ }

    try {
      await prisma.auditLog.create({
        data: {
          actorId: adminUser?.id,
          actorType: session.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
          action: "Resolved dispute: client wins — deposit released",
          entityType: "Dispute",
          entityId: disputeId,
          metadata: { resolution: resolutionText || null },
        },
      })
    } catch { /* non-blocking */ }

    if (tx.vendor?.businessEmail) {
      try {
        await sendVendorDisputeResolved(
          tx.vendor.businessEmail,
          tx.vendor.businessName ?? "Vendor",
          tx.clientProfile?.fullName ?? "the client",
          "client_wins",
          resolutionText
        )
      } catch { /* non-blocking */ }
    }

    if (tx.clientProfile?.email) {
      try {
        await sendClientDisputeResolved(
          tx.clientProfile.email,
          tx.clientProfile.fullName,
          tx.vendor?.businessName ?? "the vendor",
          "client_wins",
          resolutionText
        )
      } catch { /* non-blocking */ }
    }

    return NextResponse.json({ success: true, message: "Client's claim upheld — deposit released" })
  } catch (error) {
    console.error("Admin dispute resolution error:", error)
    return NextResponse.json({ success: false, message: "Failed to process dispute action" }, { status: 500 })
  }
}
