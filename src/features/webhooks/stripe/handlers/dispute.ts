import type Stripe from "stripe"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { mapDisputeStatus } from "@/features/webhooks/stripe/utils/dispute-status"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"

/** What partners and the dashboard learn about a chargeback (C8): kind, Stripe reason, amount, evidence deadline. */
function chargebackFacts(dispute: Stripe.Dispute) {
  const dueBy = dispute.evidence_details?.due_by
  return {
    kind: "CHARGEBACK" as const,
    reason: dispute.reason ?? null,
    amount: dispute.amount ?? null,
    currency: dispute.currency ?? null,
    evidenceDueBy: dueBy ? new Date(dueBy * 1000) : null,
    stripeDisputeId: dispute.id,
  }
}

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

  if (!payment) {
    // Post-rental charges (C6) are not Payment rows: match them by their PaymentIntent too.
    const charge = await prisma.postCharge.findUnique({
      where: { paymentIntentId },
      select: { transactionId: true, vendorId: true },
    })

    return charge ? { transactionId: charge.transactionId, vendorId: charge.vendorId } : null
  }

  return {
    transactionId: payment.transactionId,
    vendorId: payment.transaction?.vendor?.id ?? null,
  }
}

/** Looks a few more times before giving up (see `handleDisputeCreated`). */
export const DISPUTE_LOOKUP = { retries: 4, delayMs: 1_500, freshMinutes: 60 }

type DisputeLookupOptions = { now?: Date; wait?: (ms: number) => Promise<void> }

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Handles `charge.dispute.created`.
 *
 * Creates (or resets to OPEN) the Dispute record for the transaction and
 * records a timeline event so the vendor sees it immediately.
 *
 * A dispute can arrive before its payment is saved here: Stripe's test card 4000 0000 0000 0259 opens one in the
 * same second as the charge, and the event came 0.2 s before the Payment row (LOCAZ acceptance T8 #13, 20 Nov 2026),
 * so it was dropped. The payment is looked up again for a few seconds; a dispute opened within the last hour that still
 * matches nothing throws, so the event is kept FAILED and Stripe sends it again instead of it being lost.
 */
export async function handleDisputeCreated(
  dispute: Stripe.Dispute,
  eventId: string,
  eventType: string,
  options: DisputeLookupOptions = {}
): Promise<WebhookHandlerResult> {
  const paymentIntentId = extractPaymentIntentId(dispute)

  if (!paymentIntentId) {
    return { vendorId: null, transactionId: null }
  }

  const wait = options.wait ?? sleep
  let match = await findTransactionByPaymentIntent(paymentIntentId)

  for (let attempt = 0; !match && attempt < DISPUTE_LOOKUP.retries; attempt++) {
    await wait(DISPUTE_LOOKUP.delayMs)
    match = await findTransactionByPaymentIntent(paymentIntentId)
  }

  if (!match) {
    const ageMs = (options.now ?? new Date()).getTime() - dispute.created * 1000

    if (ageMs < DISPUTE_LOOKUP.freshMinutes * 60_000) {
      throw new Error(`Dispute ${dispute.id}: no payment found yet for its PaymentIntent, Stripe will send it again`)
    }

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
        ...chargebackFacts(dispute),
        openedAt: new Date(dispute.created * 1000),
        resolvedAt: null,
      },
      create: {
        transactionId,
        status: "OPEN",
        summary,
        ...chargebackFacts(dispute),
        openedAt: new Date(dispute.created * 1000),
      },
    })

    // DISPUTE_OPENED: partners get `dispute.opened` from the outbox in this same transaction.
    await recordTransactionEvent(tx, {
      transactionId,
      type: "DISPUTE_OPENED",
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
        ...chargebackFacts(dispute),
        resolvedAt: isResolved ? new Date() : null,
      },
      create: {
        transactionId,
        status: newStatus as never,
        summary,
        ...chargebackFacts(dispute),
        openedAt: new Date(dispute.created * 1000),
        resolvedAt: isResolved ? new Date() : null,
      },
    })

    // `dispute.closed` once won or lost, `dispute.updated` for any other change.
    await recordTransactionEvent(tx, {
      transactionId,
      type: isResolved ? "DISPUTE_CLOSED" : "DISPUTE_UPDATED",
      title: `Dispute ${isResolved ? "resolved" : "updated"}`,
      detail: `Dispute status changed to ${dispute.status}.`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, eventType, disputeId: dispute.id },
    })
  })

  return { vendorId, transactionId }
}
