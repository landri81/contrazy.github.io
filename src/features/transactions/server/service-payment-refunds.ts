import type { Payment, PaymentRefund, PrismaClient } from "@prisma/client"
import type Stripe from "stripe"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import type { StripeGateway } from "@/lib/integrations/stripe-gateway"

type DatabaseClient = PrismaClient
type EventClient = Parameters<typeof recordTransactionEvent>[0]

export class ServicePaymentRefundError extends Error {
  constructor(
    readonly code: "payment_not_refundable" | "refund_too_large",
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

/** The rental payment of a booking can be refunded once it went through at Stripe. */
export function isRefundableServicePayment(payment: Pick<Payment, "kind" | "status" | "stripeIntentId">) {
  return payment.kind === "SERVICE_PAYMENT" && payment.status === "SUCCEEDED" && Boolean(payment.stripeIntentId)
}

/** One timeline event per Stripe refund; the partner webhook `booking.payment_refunded` goes out from it. */
export function recordServicePaymentRefundedEvent(
  db: EventClient,
  input: { transactionId: string; refund: Pick<PaymentRefund, "id" | "amount" | "reason">; currency: string; occurredAt?: Date }
) {
  return recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: "SERVICE_PAYMENT_REFUNDED",
    title: "Rental payment refunded",
    detail: input.refund.reason,
    metadata: { refundId: input.refund.id, amount: input.refund.amount, currency: input.currency, reason: input.refund.reason },
    occurredAt: input.occurredAt,
    dedupeKey: `service_refund:${input.refund.id}`,
  })
}

/**
 * Refunds part or all of a booking's rental payment (e.g. a cancellation inside a refund window), always at Stripe,
 * never in the database only. The reason is mandatory. The Stripe key is per payment and already-refunded amount, so
 * a re-sent request refunds once.
 */
export async function refundServicePayment(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: { payment: Payment; account: string; amount?: number | null; reason: string; createdById?: string | null; now?: Date }
) {
  const { payment } = input

  if (!isRefundableServicePayment(payment)) {
    throw new ServicePaymentRefundError("payment_not_refundable", "Only a rental payment that went through can be refunded.", {
      status: payment.status.toLowerCase(),
    })
  }

  const remaining = payment.amount - payment.refundedAmount
  const amount = input.amount ?? remaining

  if (amount <= 0 || amount > remaining) {
    throw new ServicePaymentRefundError("refund_too_large", "The refund cannot exceed what is left on the rental payment.", { refundable: remaining })
  }

  const refund = await gateway.payments.createRefund(
    { payment_intent: payment.stripeIntentId!, amount, reason: "requested_by_customer", metadata: { paymentId: payment.id, reason: input.reason.slice(0, 500) } },
    { account: input.account, idempotencyKey: `service_refund_${payment.id}_${payment.refundedAmount}_${amount}` }
  )
  const now = input.now ?? new Date()

  return db.$transaction(async (tx) => {
    const existing = await tx.paymentRefund.findUnique({ where: { stripeRefundId: refund.id } })

    if (existing) {
      return { payment: await tx.payment.findUniqueOrThrow({ where: { id: payment.id } }), refund: existing }
    }

    const row = await tx.paymentRefund.create({
      data: { paymentId: payment.id, amount: refund.amount, reason: input.reason, stripeRefundId: refund.id, createdById: input.createdById ?? null },
    })
    const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } })
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { refundedAmount: Math.min(current.amount, current.refundedAmount + refund.amount) } })

    await recordServicePaymentRefundedEvent(tx, { transactionId: payment.transactionId, refund: row, currency: payment.currency, occurredAt: now })
    return { payment: updated, refund: row }
  })
}

/**
 * `charge.refunded` for a rental payment: brings the refunded amount in line with Stripe, including refunds made by
 * hand in the Stripe dashboard (each new Stripe refund gets its row and its event).
 */
export async function reconcileServicePaymentRefunds(db: DatabaseClient, stripeCharge: Stripe.Charge) {
  const paymentIntentId = typeof stripeCharge.payment_intent === "string" ? stripeCharge.payment_intent : stripeCharge.payment_intent?.id

  if (!paymentIntentId) {
    return null
  }

  const payment = await db.payment.findFirst({ where: { stripeIntentId: paymentIntentId, kind: "SERVICE_PAYMENT" } })

  if (!payment) {
    return null
  }

  for (const refund of stripeCharge.refunds?.data ?? []) {
    if (refund.status !== "succeeded" && refund.status !== "pending") continue

    await db.$transaction(async (tx) => {
      if (await tx.paymentRefund.findUnique({ where: { stripeRefundId: refund.id } })) return

      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } })
      const reason = refund.metadata?.reason || "Refunded in the Stripe dashboard"
      const row = await tx.paymentRefund.create({ data: { paymentId: payment.id, amount: refund.amount, reason, stripeRefundId: refund.id } })

      await tx.payment.update({ where: { id: payment.id }, data: { refundedAmount: Math.min(current.amount, current.refundedAmount + refund.amount) } })
      await recordServicePaymentRefundedEvent(tx, { transactionId: payment.transactionId, refund: row, currency: payment.currency })
    })
  }

  return db.payment.findUnique({ where: { id: payment.id } })
}
