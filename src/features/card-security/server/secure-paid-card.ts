import type Stripe from "stripe"

import { CardSecurityError, markCardSecured } from "@/features/card-security/server/card-security"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"

/**
 * A succeeded rental PaymentIntent created with `setup_future_usage` (C5)
 * also saved the card: mark it secured. Called by the payment-confirm route
 * and the `payment_intent.succeeded` webhook; idempotent. A refusal (no
 * consent, foreign intent) is logged and leaves the card unsecured, so the
 * flow asks for it again instead of failing the payment that went through.
 */
export async function securePaidCardIfRequested(transactionId: string, stripeAccountId: string | null, intent: Stripe.PaymentIntent) {
  if (intent.metadata?.cardSecurity !== "true" || intent.status !== "succeeded") {
    return
  }

  const account =
    stripeAccountId ??
    (await prisma.transaction.findUnique({ where: { id: transactionId }, select: { vendor: { select: { stripeAccountId: true } } } }))?.vendor
      .stripeAccountId

  if (!account) {
    return
  }

  try {
    await markCardSecured(prisma, stripeGateway, { transactionId, stripeAccountId: account, intent })
  } catch (error) {
    if (!(error instanceof CardSecurityError)) {
      throw error
    }

    console.error("Paid card not secured", { transactionId, intentId: intent.id, code: error.code })
  }
}
