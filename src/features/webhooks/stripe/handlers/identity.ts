import type Stripe from "stripe"

import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"

function extractIdentityContext(session: Stripe.Identity.VerificationSession) {
  return {
    transactionId: session.metadata?.transactionId ?? null,
    vendorId: session.metadata?.vendorId ?? null,
  }
}

/**
 * Handles `identity.verification_session.verified`.
 *
 * Acts as a reliable server-side safety net — the return page handles the
 * happy path synchronously, but if the customer closes their browser after
 * completing verification the webhook ensures the DB is updated.
 *
 * The `kycVerificationsUsed` increment is guarded: if the return page already
 * marked the record VERIFIED, the increment is skipped to avoid double-counting.
 */
export async function handleIdentitySessionVerified(
  session: Stripe.Identity.VerificationSession,
  eventId: string
): Promise<WebhookHandlerResult> {
  const { transactionId, vendorId } = extractIdentityContext(session)

  if (!transactionId || !vendorId) {
    return { vendorId: null, transactionId: null }
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.kycVerification.findUnique({
      where: { transactionId },
      select: { status: true },
    })

    if (!current) {
      // Return page hasn't created the record yet — create it.
      await tx.kycVerification.create({
        data: {
          transactionId,
          provider: "Stripe Identity",
          status: "VERIFIED",
          providerReference: session.id,
          verifiedAt: new Date(),
        },
      })
    } else {
      await tx.kycVerification.update({
        where: { transactionId },
        data: {
          status: "VERIFIED",
          providerReference: session.id,
          verifiedAt: new Date(),
        },
      })
    }

    await tx.transaction.update({
      where: { id: transactionId },
      data: { status: "KYC_VERIFIED" },
    })

    // Only increment if not already counted by the return page.
    if (current?.status !== "VERIFIED") {
      await incrementVendorSubscriptionUsage(tx, vendorId, "kycVerificationsUsed")
    }

    await recordTransactionEvent(tx, {
      transactionId,
      type: "KYC_VERIFIED",
      title: "Identity verification confirmed via webhook",
      detail: `Stripe Identity webhook confirmed verification for session ${session.id}.`,
      dedupeKey: `event:kyc-verified:${transactionId}`,
    })

    await recordTransactionEvent(tx, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Identity webhook processed",
      detail: `identity.verification_session.verified processed for ${session.id}.`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, sessionId: session.id },
    })
  })

  return { vendorId, transactionId }
}

/**
 * Handles `identity.verification_session.requires_input`.
 *
 * Fires when the customer's verification attempt failed or needs re-submission.
 * Only updates status if the session is not already VERIFIED.
 */
export async function handleIdentitySessionRequiresInput(
  session: Stripe.Identity.VerificationSession,
  eventId: string
): Promise<WebhookHandlerResult> {
  const { transactionId, vendorId } = extractIdentityContext(session)

  if (!transactionId || !vendorId) {
    return { vendorId: null, transactionId: null }
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.kycVerification.findUnique({
      where: { transactionId },
      select: { status: true },
    })

    // Don't downgrade a successfully verified record.
    if (current?.status === "VERIFIED") {
      return
    }

    if (!current) {
      await tx.kycVerification.create({
        data: {
          transactionId,
          provider: "Stripe Identity",
          status: "FAILED",
          providerReference: session.id,
          summary: session.last_error?.reason ?? "requires_input",
        },
      })
    } else {
      await tx.kycVerification.update({
        where: { transactionId },
        data: {
          status: "FAILED",
          providerReference: session.id,
          summary: session.last_error?.reason ?? "requires_input",
        },
      })
    }

    await recordTransactionEvent(tx, {
      transactionId,
      type: "KYC_FAILED",
      title: "Identity verification requires re-submission",
      detail: session.last_error?.reason
        ? `Reason: ${session.last_error.reason}`
        : "The verification session requires additional input.",
      dedupeKey: `event:kyc-failed:${transactionId}:${session.id}`,
    })

    await recordTransactionEvent(tx, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Identity webhook processed",
      detail: `identity.verification_session.requires_input processed for ${session.id}.`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, sessionId: session.id },
    })
  })

  return { vendorId, transactionId }
}
