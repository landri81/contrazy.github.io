import type Stripe from "stripe"

import { applyPostChargeIntent, reconcilePostChargeRefunds } from "@/features/card-security/server/post-charges"
import type { PartnerChargeOutcome } from "@/features/partner-webhooks/server/charge-events"
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

/** `charge.refunded`: refunds of a post-rental charge, including ones made in the Stripe dashboard. Other charges are ignored. */
export async function handlePostChargeRefunded(charge: Stripe.Charge): Promise<WebhookHandlerResult> {
  const updated = await reconcilePostChargeRefunds(prisma, charge)
  return { vendorId: updated?.vendorId ?? null, transactionId: updated?.transactionId ?? null }
}
