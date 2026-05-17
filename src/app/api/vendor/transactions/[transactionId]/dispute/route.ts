import { NextResponse } from "next/server"
import { z } from "zod"
import { AuditActorType } from "@prisma/client"

import { vendorDisputeCreateSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { recordDepositOutcome, recordFinanceAuditLog } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import {
  sendAdminDisputeAlert,
  sendClientDisputeOpenedEmail,
  sendClientDisputeResolved,
  sendVendorDisputeOpenedEmail,
  sendVendorDisputeResolved,
} from "@/lib/integrations/resend"
import { env } from "@/lib/env"
import { getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"
import { getSiteUrl } from "@/lib/site-url"
import { optionalText } from "@/lib/validation/text-schemas"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

export const runtime = "nodejs"
export const maxDuration = 30

const disputeResolveBodySchema = z.object({
  action: z.enum(["resolve_keep", "resolve_release"]),
  resolution: optionalText("Resolution note", INPUT_LIMITS.adminDisputeResolution).optional(),
})

const evidenceImageSchema = z.object({
  assetUrl: z.string().url(),
  publicId: z.string().min(1),
  fileName: z.string().min(1),
})

const disputeCreateBodySchema = vendorDisputeCreateSchema.and(
  z.object({
    evidenceImages: z.array(evidenceImageSchema).max(10).optional(),
  })
)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) return response

    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) return blockedResponse

    const body = await request.json()
    const parsedBody = disputeCreateBodySchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid dispute data." },
        { status: 400 }
      )
    }

    const { summary, evidenceImages } = parsedBody.data

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: {
        depositAuthorization: true,
        dispute: true,
        clientProfile: true,
        contractArtifact: { select: { signedPdfPublicId: true } },
        vendor: true,
      },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    if (transaction.dispute) {
      return NextResponse.json(
        { success: false, message: "A dispute is already open for this transaction" },
        { status: 409 }
      )
    }

    if (transaction.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, message: "Cannot open a dispute on a cancelled transaction" },
        { status: 400 }
      )
    }

    const depositStatus = transaction.depositAuthorization?.status
    const depositIsActive = depositStatus === "AUTHORIZED" || depositStatus === "SUCCEEDED"

    if (!depositIsActive) {
      return NextResponse.json(
        { success: false, message: "A dispute can only be opened while the deposit is still active." },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.dispute.create({
        data: {
          transactionId: transaction.id,
          status: "OPEN",
          summary,
          evidenceImages: evidenceImages ?? [],
          openedAt: new Date(),
        },
      })

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "DISPUTED" },
      })
    })

    const createdDispute = await prisma.dispute.findUnique({ where: { transactionId: transaction.id } })

    try {
      await recordTransactionEvent(prisma, {
        transactionId: transaction.id,
        type: "DISPUTE_OPENED",
        title: "Dispute opened by vendor",
        detail: summary.slice(0, 200),
        dedupeKey: `event:dispute-opened:${transaction.id}`,
      })
    } catch (eventErr) {
      console.warn("Dispute event recording failed:", eventErr)
    }

    const disputeId = createdDispute?.id ?? transaction.id
    const vendorName = vendorProfile.businessName ?? "Unknown vendor"
    const clientName = transaction.clientProfile?.fullName ?? "Unknown client"
    const vendorLocale = vendorProfile.preferredLocale ?? "en"
    const clientLocale = transaction.locale ?? "en"
    const vendorLogoUrl = (vendorProfile as typeof vendorProfile & { businessLogoUrl?: string | null }).businessLogoUrl ?? null
    const depositAmount = transaction.depositAuthorization?.amount ?? null
    const currency = transaction.depositAuthorization?.currency ?? transaction.currency

    const signedPdfPublicId = transaction.contractArtifact?.signedPdfPublicId
    const signedAgreementUrl = signedPdfPublicId
      ? `${getSiteUrl()}/api/integrations/cloudinary/download?publicId=${encodeURIComponent(signedPdfPublicId)}&resourceType=raw&format=pdf&fileName=${encodeURIComponent(`${transaction.reference}-signed.pdf`)}`
      : null

    const emailDetails = {
      transactionRef: transaction.reference,
      transactionTitle: transaction.title,
      depositAmount,
      currency,
      signedAgreementUrl,
      evidenceImages: evidenceImages ?? [],
    }

    // Vendor confirmation
    if (vendorProfile.businessEmail) {
      sendVendorDisputeOpenedEmail(
        vendorProfile.businessEmail,
        vendorName,
        clientName,
        disputeId,
        summary,
        emailDetails,
        vendorLocale,
        vendorLogoUrl
      ).catch(() => {})
    }

    // Client notification
    if (transaction.clientProfile?.email) {
      sendClientDisputeOpenedEmail(
        transaction.clientProfile.email,
        clientName,
        vendorName,
        disputeId,
        summary,
        emailDetails,
        clientLocale,
        vendorLogoUrl
      ).catch(() => {})
    }

    // Admin audit notification (read-only)
    if (env.SUPER_ADMIN_EMAIL) {
      sendAdminDisputeAlert(
        env.SUPER_ADMIN_EMAIL,
        vendorName,
        clientName,
        transaction.reference,
        summary,
        disputeId
      ).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Dispute Open Error:", error)
    return NextResponse.json({ success: false, message: "Failed to open dispute" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) return response

    const blockedResponse = ensureVendorApproved(vendorProfile)
    if (blockedResponse) return blockedResponse

    const body = await request.json()
    const parsedBody = disputeResolveBodySchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid resolution data." },
        { status: 400 }
      )
    }

    const { action, resolution } = parsedBody.data

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: {
        depositAuthorization: true,
        dispute: true,
        clientProfile: true,
        contractArtifact: { select: { signedPdfPublicId: true } },
        vendor: true,
      },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    if (!transaction.dispute) {
      return NextResponse.json({ success: false, message: "No dispute found for this transaction" }, { status: 404 })
    }

    if (transaction.dispute.status === "RESOLVED" || transaction.dispute.status === "LOST") {
      return NextResponse.json({ success: false, message: "Dispute is already resolved" }, { status: 409 })
    }

    const depositAuth = transaction.depositAuthorization
    const depositIsActive = depositAuth?.status === "AUTHORIZED" || depositAuth?.status === "SUCCEEDED"

    if (!depositAuth || !depositIsActive) {
      return NextResponse.json(
        { success: false, message: "Deposit is not in an active state" },
        { status: 400 }
      )
    }

    if (!depositAuth.stripeIntentId) {
      return NextResponse.json({ success: false, message: "No active Stripe deposit found" }, { status: 400 })
    }

    const isChargeRefund = depositAuth.depositStrategy === "CHARGE_REFUND"
    const now = new Date()
    const resolutionText = resolution ?? ""
    const disputeId = transaction.dispute.id
    const vendorName = vendorProfile.businessName ?? "Unknown vendor"
    const clientName = transaction.clientProfile?.fullName ?? "Unknown client"
    const vendorLocale = vendorProfile.preferredLocale ?? "en"
    const clientLocale = transaction.locale ?? "en"
    const vendorLogoUrl = (vendorProfile as typeof vendorProfile & { businessLogoUrl?: string | null }).businessLogoUrl ?? null
    const stripeOpts = getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)

    const signedPdfPublicId = transaction.contractArtifact?.signedPdfPublicId
    const signedAgreementUrl = signedPdfPublicId
      ? `${getSiteUrl()}/api/integrations/cloudinary/download?publicId=${encodeURIComponent(signedPdfPublicId)}&resourceType=raw&format=pdf&fileName=${encodeURIComponent(`${transaction.reference}-signed.pdf`)}`
      : null

    const emailDetails = {
      transactionRef: transaction.reference,
      transactionTitle: transaction.title,
      depositAmount: depositAuth.amount,
      currency: depositAuth.currency ?? transaction.currency,
      signedAgreementUrl,
    }

    // ── Vendor keeps deposit (vendor wins) ──────────────────────────────────
    if (action === "resolve_keep") {
      if (isChargeRefund) {
        // For CHARGE_REFUND: money already settled — mark as captured to prevent auto-refund cron
        await prisma.$transaction(async (tx) => {
          await tx.depositAuthorization.update({
            where: { id: depositAuth.id },
            data: {
              status: "CAPTURED",
              capturedAt: now,
              depositCapturedAmount: depositAuth.amount,
            },
          })

          await tx.dispute.update({
            where: { id: disputeId },
            data: {
              status: "RESOLVED",
              resolution: resolutionText || "vendor_wins",
              resolvedAt: now,
            },
          })

          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: "COMPLETED" },
          })
        })
      } else {
        // For HOLD_CAPTURE: capture the authorized hold via Stripe
        await stripe.paymentIntents.capture(depositAuth.stripeIntentId, {}, stripeOpts)

        await prisma.$transaction(async (tx) => {
          await tx.depositAuthorization.update({
            where: { id: depositAuth.id },
            data: {
              status: "CAPTURED",
              capturedAt: now,
              depositCapturedAmount: depositAuth.amount,
            },
          })

          await tx.dispute.update({
            where: { id: disputeId },
            data: {
              status: "RESOLVED",
              resolution: resolutionText || "vendor_wins",
              resolvedAt: now,
            },
          })

          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: "COMPLETED" },
          })
        })
      }

      try {
        await recordTransactionEvent(prisma, {
          transactionId: transaction.id,
          type: "DISPUTE_OPENED",
          title: "Dispute resolved — vendor's claim upheld",
          detail: resolutionText || "Vendor chose to retain the deposit.",
          dedupeKey: `event:dispute-resolved:${disputeId}`,
          metadata: { resolutionOutcome: "vendor_wins", resolutionNote: resolutionText || null },
        })
      } catch { /* non-blocking */ }

      try {
        await recordFinanceAuditLog(prisma, {
          actorType: AuditActorType.USER,
          action: "Vendor resolved dispute: deposit captured (vendor wins)",
          entityType: "Dispute",
          entityId: disputeId,
          metadata: {
            transactionId: transaction.id,
            resolutionOutcome: "vendor_wins",
            resolutionNote: resolutionText || null,
            depositAuthorizationId: depositAuth.id,
            amount: depositAuth.amount,
            currency: depositAuth.currency,
            stripeIntentId: depositAuth.stripeIntentId,
          },
        })
      } catch { /* non-blocking */ }

      if (vendorProfile.businessEmail) {
        sendVendorDisputeResolved(
          vendorProfile.businessEmail,
          vendorName,
          clientName,
          "vendor_wins",
          resolutionText,
          vendorLocale,
          vendorLogoUrl,
          emailDetails
        ).catch(() => {})
      }

      if (transaction.clientProfile?.email) {
        sendClientDisputeResolved(
          transaction.clientProfile.email,
          clientName,
          vendorName,
          "vendor_wins",
          resolutionText,
          clientLocale,
          vendorLogoUrl,
          emailDetails
        ).catch(() => {})
      }

      return NextResponse.json({ success: true, message: "Dispute resolved — deposit retained" })
    }

    // ── Vendor releases deposit (client wins) ───────────────────────────────
    let refundId: string | null = null
    let refundAmount: number | null = null

    if (isChargeRefund) {
      const refund = await stripe.refunds.create(
        { payment_intent: depositAuth.stripeIntentId, reason: "requested_by_customer" },
        stripeOpts
      )
      refundId = refund.id
      refundAmount = refund.amount
    } else {
      await stripe.paymentIntents.cancel(depositAuth.stripeIntentId, {}, stripeOpts)
    }

    await prisma.$transaction(async (tx) => {
      await tx.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: {
          status: "RELEASED",
          releasedAt: now,
          ...(isChargeRefund && refundId
            ? { depositRefundedAt: now, depositRefundId: refundId, depositRefundedAmount: refundAmount }
            : {}),
        },
      })

      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: "LOST",
          resolution: resolutionText || "client_wins",
          resolvedAt: now,
        },
      })

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "COMPLETED" },
      })
    })

    await recordDepositOutcome(prisma, {
      transactionId: transaction.id,
      amount: depositAuth.amount,
      actualAmount: depositAuth.amount,
      currency: depositAuth.currency,
      stripeIntentId: depositAuth.stripeIntentId,
      action: "release",
      reason: "vendor_dispute_release",
      vendorBusinessEmail: vendorProfile.businessEmail,
      vendorBusinessName: vendorProfile.businessName,
      clientFullName: transaction.clientProfile?.fullName,
      clientEmail: transaction.clientProfile?.email,
      occurredAt: now,
      locale: transaction.locale,
      vendorLocale,
      vendorLogoUrl,
    })

    try {
      await recordTransactionEvent(prisma, {
        transactionId: transaction.id,
        type: "DISPUTE_OPENED",
        title: "Dispute resolved — deposit released to client",
        detail: resolutionText || "Vendor chose to release the deposit.",
        dedupeKey: `event:dispute-resolved:${disputeId}`,
        metadata: { resolutionOutcome: "client_wins", resolutionNote: resolutionText || null },
      })
    } catch { /* non-blocking */ }

    try {
      await recordFinanceAuditLog(prisma, {
        actorType: AuditActorType.USER,
        action: "Vendor resolved dispute: deposit released (client wins)",
        entityType: "Dispute",
        entityId: disputeId,
        metadata: {
          transactionId: transaction.id,
          resolutionOutcome: "client_wins",
          resolutionNote: resolutionText || null,
          depositAuthorizationId: depositAuth.id,
          amount: depositAuth.amount,
          currency: depositAuth.currency,
          stripeIntentId: depositAuth.stripeIntentId,
        },
      })
    } catch { /* non-blocking */ }

    if (vendorProfile.businessEmail) {
      sendVendorDisputeResolved(
        vendorProfile.businessEmail,
        vendorName,
        clientName,
        "client_wins",
        resolutionText,
        vendorLocale,
        vendorLogoUrl,
        emailDetails
      ).catch(() => {})
    }

    if (transaction.clientProfile?.email) {
      sendClientDisputeResolved(
        transaction.clientProfile.email,
        clientName,
        vendorName,
        "client_wins",
        resolutionText,
        clientLocale,
        vendorLogoUrl,
        emailDetails
      ).catch(() => {})
    }

    return NextResponse.json({ success: true, message: "Dispute resolved — deposit released" })
  } catch (error) {
    console.error("Dispute Resolve Error:", error)
    return NextResponse.json({ success: false, message: "Failed to resolve dispute" }, { status: 500 })
  }
}
