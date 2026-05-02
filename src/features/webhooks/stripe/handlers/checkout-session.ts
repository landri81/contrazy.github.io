import type Stripe from "stripe"

import {
  syncTransactionFinanceState,
  upsertDepositAuthorization,
  upsertServicePayment,
} from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"

function extractSessionContext(session: Stripe.Checkout.Session): {
  vendorId: string | null
  transactionId: string | null
  financeStage: string | null
  paymentIntentId: string | null
} {
  return {
    vendorId: session.metadata?.vendorId ?? null,
    transactionId: session.metadata?.transactionId ?? null,
    financeStage: session.metadata?.financeStage ?? null,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
  }
}

/**
 * Handles `checkout.session.completed` and
 * `checkout.session.async_payment_succeeded`.
 *
 * Upserts the service payment or deposit authorization record, records a
 * transaction event, then syncs the overall finance state (which may mark the
 * transaction COMPLETED and send notification emails).
 */
export async function handleCheckoutSuccess(
  session: Stripe.Checkout.Session,
  eventId: string,
  eventType: string
): Promise<WebhookHandlerResult> {
  const { vendorId, transactionId, financeStage } = extractSessionContext(session)

  if (transactionId) {
    await prisma.$transaction(async (tx) => {
      if (financeStage === "deposit_authorization") {
        await upsertDepositAuthorization(tx, transactionId, session)
      } else {
        await upsertServicePayment(tx, transactionId, session)
      }

      await recordTransactionEvent(tx, {
        transactionId,
        type: "WEBHOOK_PROCESSED",
        title: "Stripe payment confirmed",
        detail: `${eventType} handled successfully.`,
        dedupeKey: `webhook:${eventId}`,
        metadata: { eventId, eventType },
      })
    })

    await syncTransactionFinanceState(prisma, transactionId)
  }

  return { vendorId, transactionId }
}

/**
 * Handles `checkout.session.async_payment_failed`.
 *
 * Marks the payment record as FAILED so the transaction timeline reflects the
 * failure and the vendor can act accordingly.
 */
export async function handleCheckoutPaymentFailed(
  session: Stripe.Checkout.Session,
  eventId: string,
  eventType: string
): Promise<WebhookHandlerResult> {
  const { vendorId, transactionId, financeStage, paymentIntentId } =
    extractSessionContext(session)

  if (transactionId) {
    const paymentKind =
      financeStage === "deposit_authorization" ? "DEPOSIT_AUTHORIZATION" : "SERVICE_PAYMENT"

    await prisma.$transaction(async (tx) => {
      await tx.payment.upsert({
        where: {
          transactionId_kind: {
            transactionId,
            kind: paymentKind as never,
          },
        },
        update: {
          status: "FAILED",
          stripeIntentId: paymentIntentId,
          processedAt: new Date(),
        },
        create: {
          transactionId,
          kind: paymentKind as never,
          status: "FAILED",
          amount: session.amount_total ?? 0,
          currency: (session.currency ?? "eur").toUpperCase(),
          stripeIntentId: paymentIntentId,
          processedAt: new Date(),
        },
      })

      await recordTransactionEvent(tx, {
        transactionId,
        type: "WEBHOOK_PROCESSED",
        title: "Payment failed",
        detail: "The async payment attempt was not completed by the customer.",
        dedupeKey: `webhook:${eventId}`,
        metadata: { eventId, eventType },
      })
    })
  }

  return { vendorId, transactionId }
}

/**
 * Handles `checkout.session.expired`.
 *
 * Records a timeline event so the vendor can see the session expired and
 * choose to resend the link.
 */
export async function handleCheckoutExpired(
  session: Stripe.Checkout.Session,
  eventId: string,
  eventType: string
): Promise<WebhookHandlerResult> {
  const { vendorId, transactionId } = extractSessionContext(session)

  if (transactionId) {
    await recordTransactionEvent(prisma, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Checkout session expired",
      detail: "The Stripe checkout session expired before the customer completed payment.",
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, eventType },
    })
  }

  return { vendorId, transactionId }
}
