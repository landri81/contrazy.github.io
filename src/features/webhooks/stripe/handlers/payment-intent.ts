import type Stripe from "stripe"

import {
  syncTransactionFinanceState,
  upsertDepositAuthorizationFromIntent,
  upsertServicePaymentFromIntent,
} from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"

function extractIntentContext(intent: Stripe.PaymentIntent) {
  return {
    transactionId: intent.metadata?.transactionId ?? null,
    vendorId: intent.metadata?.vendorId ?? null,
    financeStage: intent.metadata?.financeStage ?? null,
  }
}

/**
 * Handles `payment_intent.succeeded` — service payment confirmed.
 * Acts as async safety net; the payment-confirm endpoint does this
 * optimistically client-side so the user doesn't wait for the webhook.
 */
export async function handlePaymentIntentSucceeded(
  intent: Stripe.PaymentIntent,
  eventId: string,
  eventType: string
): Promise<WebhookHandlerResult> {
  const { transactionId, vendorId, financeStage } = extractIntentContext(intent)

  if (transactionId && financeStage !== "deposit_authorization") {
    await upsertServicePaymentFromIntent(prisma, transactionId, intent)

    await recordTransactionEvent(prisma, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Service payment webhook confirmed",
      detail: `${eventType} processed for PaymentIntent ${intent.id}.`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, eventType, intentId: intent.id },
    })

    await syncTransactionFinanceState(prisma, transactionId)
  }

  return { vendorId, transactionId }
}

/**
 * Handles `payment_intent.amount_capturable_updated` — deposit authorization held.
 * Fires when a manual-capture PaymentIntent moves to `requires_capture`.
 */
export async function handlePaymentIntentCapturableUpdated(
  intent: Stripe.PaymentIntent,
  eventId: string,
  eventType: string
): Promise<WebhookHandlerResult> {
  const { transactionId, vendorId, financeStage } = extractIntentContext(intent)

  if (transactionId && financeStage === "deposit_authorization") {
    await upsertDepositAuthorizationFromIntent(prisma, transactionId, intent)

    await recordTransactionEvent(prisma, {
      transactionId,
      type: "WEBHOOK_PROCESSED",
      title: "Deposit authorization webhook confirmed",
      detail: `${eventType} processed for PaymentIntent ${intent.id}.`,
      dedupeKey: `webhook:${eventId}`,
      metadata: { eventId, eventType, intentId: intent.id },
    })

    await syncTransactionFinanceState(prisma, transactionId)
  }

  return { vendorId, transactionId }
}
