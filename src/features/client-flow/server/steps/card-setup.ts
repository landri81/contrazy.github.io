import { CardSecurityError, ensurePartnerCustomer, findCardConsent, markCardSecured, setupFailureMessage, startCardSetup } from "@/features/card-security/server/card-security"
import type { loadClientCardSecurityContext } from "@/features/card-security/server/client-card-security"
import { getNextFinanceStage, syncTransactionFinanceState } from "@/features/transactions/server/transaction-finance"
import { prisma } from "@/lib/db/prisma"
import { getStripePublishableKey, stripeGateway } from "@/lib/integrations/stripe"

/**
 * The card saved on its own ("card as security only", Spec v2.1 §4), shared (M10): the SetupIntent after consent, and
 * its confirmation read at Stripe. Contrazy's payment page and the partner API's embedded checkout call them.
 */

export type CardSecurityContext = Exclude<Awaited<ReturnType<typeof loadClientCardSecurityContext>>, { error: unknown }>

export type CardSetupStartResult = {
  status: number
  body: {
    success: boolean
    code?: string
    message?: string
    /** Nothing to save now: the step the customer is on instead. */
    next?: "complete" | "payment"
    clientSecret?: string | null
    setupIntentId?: string
    stripeAccountId?: string
    publishableKey?: string
  }
}

/** A SetupIntent with usage off_session on the vendor's connected account, for the customer's Stripe customer; consent first. */
export async function startClientCardSetup({ transaction, stripeAccountId, financeStage }: CardSecurityContext): Promise<CardSetupStartResult> {
  if (financeStage !== "card_security") {
    return { status: 200, body: { success: true, next: financeStage === "complete" ? "complete" : "payment" } }
  }

  const consent = await findCardConsent(prisma, transaction.id)

  if (!consent) {
    return { status: 409, body: { success: false, code: "consent_required", message: "Please accept the card terms first." } }
  }

  try {
    const profile = transaction.clientProfile
    const partnerCustomer = await ensurePartnerCustomer(prisma, stripeGateway, {
      vendorId: transaction.vendorId,
      stripeAccountId,
      email: profile?.email ?? "",
      name: profile?.fullName ?? null,
      phone: profile?.phone ?? null,
    })
    const intent = await startCardSetup(prisma, stripeGateway, {
      transactionId: transaction.id,
      stripeAccountId,
      partnerCustomer,
      termsVersion: consent.termsVersion,
      reference: transaction.reference,
    })

    return {
      status: 200,
      body: { success: true, clientSecret: intent.client_secret, setupIntentId: intent.id, stripeAccountId, publishableKey: getStripePublishableKey() },
    }
  } catch (error) {
    if (error instanceof CardSecurityError && error.code === "customer_email_missing") {
      return { status: 422, body: { success: false, code: error.code, message: error.message } }
    }

    throw error
  }
}

export type CardSetupConfirmResult = { status: number; body: { success: boolean; code?: string; message?: string; status?: string; nextStep?: "complete" | "payment" } }

/** After `stripe.confirmSetup` in the browser: the SetupIntent read at Stripe (never trusted from the browser), the card marked secured. */
export async function confirmClientCardSetup({ transaction, stripeAccountId }: CardSecurityContext, setupIntentId: string): Promise<CardSetupConfirmResult> {
  if (transaction.cardSecurity?.setupIntentId !== setupIntentId) {
    return { status: 403, body: { success: false, message: "Setup intent mismatch" } }
  }

  const intent = await stripeGateway.payments.retrieveSetupIntent(setupIntentId, { account: stripeAccountId })

  if (intent.status === "processing") {
    return { status: 200, body: { success: true, status: "processing", nextStep: "payment" } }
  }

  if (intent.status !== "succeeded") {
    return { status: 422, body: { success: false, message: setupFailureMessage(intent) ?? "Your card could not be saved. Please try another card." } }
  }

  try {
    await markCardSecured(prisma, stripeGateway, { transactionId: transaction.id, stripeAccountId, intent })
  } catch (error) {
    if (error instanceof CardSecurityError) {
      return { status: 409, body: { success: false, code: error.code, message: error.message } }
    }

    throw error
  }

  const updated = await syncTransactionFinanceState(prisma, transaction.id)
  const nextStage = updated ? getNextFinanceStage(updated) : "complete"

  return { status: 200, body: { success: true, status: "confirmed", nextStep: nextStage === "complete" ? "complete" : "payment" } }
}
