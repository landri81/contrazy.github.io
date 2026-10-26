import type Stripe from "stripe"

import { applyPostChargeIntent, reconcilePostChargeRefunds } from "@/features/card-security/server/post-charges"
import type { PartnerChargeOutcome } from "@/features/partner-webhooks/server/charge-events"
import { reconcileServicePaymentRefunds } from "@/features/transactions/server/service-payment-refunds"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"
import { prisma } from "@/lib/db/prisma"

/** Charge intents (C6) carry `metadata.postChargeId`; they are never rental payments or deposits. */
export function isPostChargeIntent(intent: Stripe.PaymentIntent) {
  return Boolean(intent.metadata?.postChargeId)
}

/** `payment_intent.succeeded | payment_failed | requires_action` for a post-rental charge. */
export async function handlePostChargeIntent(intent: Stripe.PaymentIntent, outcome: PartnerChargeOutcome): Promise<WebhookHandlerResult> {
  const charge = await applyPostChargeIntent(prisma, intent, outcome)
  return { vendorId: charge?.vendorId ?? intent.metadata?.vendorId ?? null, transactionId: charge?.transactionId ?? intent.metadata?.transactionId ?? null }
}

/**
 * `charge.refunded`: refunds of a post-rental charge or of a rental payment (C9), including ones made in the Stripe
 * dashboard. Other charges are ignored.
 */
export async function handleChargeRefunded(charge: Stripe.Charge): Promise<WebhookHandlerResult> {
  const updated = await reconcilePostChargeRefunds(prisma, charge)

  if (updated) {
    return { vendorId: updated.vendorId, transactionId: updated.transactionId }
  }

  const payment = await reconcileServicePaymentRefunds(prisma, charge)

  if (!payment) {
    return { vendorId: null, transactionId: null }
  }

  const transaction = await prisma.transaction.findUnique({ where: { id: payment.transactionId }, select: { vendorId: true } })
  return { vendorId: transaction?.vendorId ?? null, transactionId: payment.transactionId }
}
