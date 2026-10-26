import type { Prisma, PrismaClient } from "@prisma/client"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

/**
 * The only way to record the saved-card, off-session charge and refund
 * timeline events (CARD_SECURED, CHARGE_SUCCEEDED, CHARGE_FAILED,
 * CHARGE_REQUIRES_ACTION, REFUND_SUCCEEDED). They go through
 * `recordTransactionEvent`, so partner bookings get the matching
 * `booking.card_secured`, `charge.*` and `refund.succeeded` webhooks from the
 * outbox in the same database transaction.
 *
 * Callers: the card-security step (C5: SetupIntent succeeded) and the
 * post-charge / refund code paths (C6: off-session PaymentIntent outcome,
 * Stripe `payment_intent.*` and `charge.refunded` webhooks). Contrazy has no
 * such code path before C5/C6, which must call these helpers rather than
 * `recordTransactionEvent` directly.
 *
 * Metadata holds only the facts the payload allow-lists: never card numbers,
 * brand, last4, PaymentMethod or PaymentIntent ids.
 */

export type PartnerChargeOutcome = "succeeded" | "failed" | "requires_action"

export type PartnerChargeFacts = {
  id: string
  externalRef?: string | null
  type: string
  amount: number
  currency: string
  attempt: number
  declineCode?: string | null
  nextRetryAt?: Date | null
  paymentLinkUrl?: string | null
  cardUpdateUrl?: string | null
}

export type PartnerRefundFacts = {
  id: string
  chargeId: string
  amount: number
  currency: string
  reason: string
}

const CHARGE_EVENT_TYPES = {
  succeeded: "CHARGE_SUCCEEDED",
  failed: "CHARGE_FAILED",
  requires_action: "CHARGE_REQUIRES_ACTION",
} as const

const CHARGE_EVENT_TITLES: Record<PartnerChargeOutcome, string> = {
  succeeded: "Charge succeeded",
  failed: "Charge failed",
  requires_action: "Charge needs customer action",
}

export function buildChargeEventMetadata(outcome: PartnerChargeOutcome, charge: PartnerChargeFacts) {
  return {
    chargeId: charge.id,
    externalRef: charge.externalRef ?? null,
    type: charge.type,
    amount: charge.amount,
    currency: charge.currency,
    status: outcome,
    attempt: charge.attempt,
    declineCode: outcome === "succeeded" ? null : (charge.declineCode ?? null),
    nextRetryAt: outcome === "failed" ? (charge.nextRetryAt?.toISOString() ?? null) : null,
    paymentLinkUrl: outcome === "succeeded" ? null : (charge.paymentLinkUrl ?? null),
    cardUpdateUrl: outcome === "succeeded" ? null : (charge.cardUpdateUrl ?? null),
  }
}

/** Card saved for later off-session use (SetupIntent succeeded). Once per booking. */
export function recordCardSecuredEvent(
  db: DatabaseClient,
  input: { transactionId: string; usage?: "off_session" | "on_session"; occurredAt?: Date }
) {
  return recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: "CARD_SECURED",
    title: "Card secured",
    detail: "The customer saved a card for charges after the rental.",
    metadata: { usage: input.usage ?? "off_session" },
    occurredAt: input.occurredAt,
    dedupeKey: `card_secured:${input.transactionId}`,
  })
}

/** Outcome of one attempt of an off-session charge. One event per charge, attempt and outcome. */
export function recordChargeOutcomeEvent(
  db: DatabaseClient,
  input: { transactionId: string; outcome: PartnerChargeOutcome; charge: PartnerChargeFacts; occurredAt?: Date }
) {
  return recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: CHARGE_EVENT_TYPES[input.outcome],
    title: CHARGE_EVENT_TITLES[input.outcome],
    detail: input.charge.declineCode && input.outcome !== "succeeded" ? `Decline code: ${input.charge.declineCode}` : null,
    metadata: buildChargeEventMetadata(input.outcome, input.charge),
    occurredAt: input.occurredAt,
    dedupeKey: `charge:${input.charge.id}:attempt:${input.charge.attempt}:${input.outcome}`,
  })
}

/** Refund confirmed by Stripe (never on a DB-only refund). One event per refund. */
export function recordRefundSucceededEvent(
  db: DatabaseClient,
  input: { transactionId: string; refund: PartnerRefundFacts; occurredAt?: Date }
) {
  return recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: "REFUND_SUCCEEDED",
    title: "Refund succeeded",
    detail: input.refund.reason,
    metadata: {
      refundId: input.refund.id,
      chargeId: input.refund.chargeId,
      amount: input.refund.amount,
      currency: input.refund.currency,
      reason: input.refund.reason,
    },
    occurredAt: input.occurredAt,
    dedupeKey: `refund:${input.refund.id}`,
  })
}
