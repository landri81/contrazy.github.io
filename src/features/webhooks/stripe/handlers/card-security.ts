import type Stripe from "stripe"

import { CardSecurityError, markCardSecured } from "@/features/card-security/server/card-security"
import { syncTransactionFinanceState } from "@/features/transactions/server/transaction-finance"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"

/**
 * `setup_intent.succeeded` on a vendor's connected account: the "card as
 * security only" form saved the card. Safety net for the client confirm call
 * (same idempotent `markCardSecured`). Intents that are not ours are ignored.
 */
export async function handleSetupIntentSucceeded(
  intent: Stripe.SetupIntent,
  eventId: string,
  account: string | null
): Promise<WebhookHandlerResult> {
  const transactionId = intent.metadata?.cardSecurity === "true" ? (intent.metadata.transactionId ?? null) : null

  if (!transactionId) {
    return { vendorId: null, transactionId: null }
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { vendorId: true, vendor: { select: { stripeAccountId: true } } },
  })
  const stripeAccountId = transaction?.vendor.stripeAccountId

  // The event must come from the vendor's own account.
  if (!transaction || !stripeAccountId || (account && account !== stripeAccountId)) {
    return { vendorId: transaction?.vendorId ?? null, transactionId: null }
  }

  try {
    await markCardSecured(prisma, stripeGateway, { transactionId, stripeAccountId, intent })
    await syncTransactionFinanceState(prisma, transactionId)
  } catch (error) {
    if (!(error instanceof CardSecurityError)) {
      throw error
    }

    console.error("Card security webhook skipped", { eventId, transactionId, code: error.code })
  }

  return { vendorId: transaction.vendorId, transactionId }
}
