import type Stripe from "stripe"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { mapDisputeStatus } from "@/features/webhooks/stripe/utils/dispute-status"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"

function extractPaymentIntentId(dispute: Stripe.Dispute): string | null {
  return typeof dispute.payment_intent === "string"
    ? dispute.payment_intent
    : (dispute.payment_intent?.id ?? null)
}

/**
 * Looks up a Payment record by Stripe payment intent ID and returns both the
 * transactionId and vendorId if found. Returns null when no match exists.
 */
async function findTransactionByPaymentIntent(paymentIntentId: string): Promise<{
  transactionId: string
  vendorId: string | null
} | null> {
  const payment = await prisma.payment.findFirst({
    where: { stripeIntentId: paymentIntentId },
    select: {
      transactionId: true,
      transaction: {
        select: { vendor: { select: { id: true } } },
      },
    },
  })

  if (!payment) return null

  return {
    transactionId: payment.transactionId,
    vendorId: payment.transaction?.vendor?.id ?? null,
  }
}

/**
 * Handles `charge.dispute.created`.
 *
 * Creates (or resets to OPEN) the Dispute record for the transaction and
 * records a timeline event so the vendor sees it immediately.
 */
export async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  eventId: string,
  eventType: string
): Promise<WebhookHandlerResult> {
  const paymentIntentId = extractPaymentIntentId(dispute)

  if (!paymentIntentId) {
    return { vendorId: null, transactionId: null }
  }

  const match = await findTransactionByPaymentIntent(paymentIntentId)

  if (!match) {
    return { vendorId: null, transactionId: null }
  }

  const { transactionId, vendorId } = match
  const summary = `Stripe dispute opened. Reason: ${dispute.reason ?? "unspecified"}.`

  await prisma.$transaction(async (tx) => {
    await tx.dispute.upsert({
      where: { transactionId },
      update: {
        status: "OPEN",
        summary,
        openedAt: new Date(dispute.created * 1000),
        resolvedAt: null,
      },
      create: {
        transactionId,
        status: "OPEN",
        summary,
        openedAt: new Date(dispute.created * 1000),
      },
    })

    await recordTransactionEvent(tx, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Dispute opened",
      detail: summary,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, eventType, disputeId: dispute.id },
    })
  })

  return { vendorId, transactionId }
}

/**
 * Handles `charge.dispute.updated` and `charge.dispute.closed`.
 *
 * Syncs the dispute status from Stripe and sets `resolvedAt` when the dispute
 * is won or lost.
 */
export async function handleDisputeUpdated(
  dispute: Stripe.Dispute,
  eventId: string,
  eventType: string
): Promise<WebhookHandlerResult> {
  const paymentIntentId = extractPaymentIntentId(dispute)

  if (!paymentIntentId) {
    return { vendorId: null, transactionId: null }
  }

  const match = await findTransactionByPaymentIntent(paymentIntentId)

  if (!match) {
    return { vendorId: null, transactionId: null }
  }

  const { transactionId, vendorId } = match
  const newStatus = mapDisputeStatus(dispute.status)
  const isResolved = newStatus === "RESOLVED" || newStatus === "LOST"
  const summary = `Dispute status: ${dispute.status}. Reason: ${dispute.reason ?? "unspecified"}.`

  await prisma.$transaction(async (tx) => {
    await tx.dispute.upsert({
      where: { transactionId },
      update: {
        status: newStatus as never,
        summary,
        resolvedAt: isResolved ? new Date() : null,
      },
      create: {
        transactionId,
        status: newStatus as never,
        summary,
        openedAt: new Date(dispute.created * 1000),
        resolvedAt: isResolved ? new Date() : null,
      },
    })

    await recordTransactionEvent(tx, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: `Dispute ${isResolved ? "resolved" : "updated"}`,
      detail: `Dispute status changed to ${dispute.status}.`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, eventType, disputeId: dispute.id },
    })
  })

  return { vendorId, transactionId }
}
