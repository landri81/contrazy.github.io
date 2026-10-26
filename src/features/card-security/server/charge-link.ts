import type Stripe from "stripe"

import { ensurePartnerCustomer, recordCardConsent } from "@/features/card-security/server/card-security"
import { applyPostChargeIntent, attemptPostCharge, linkKindFor } from "@/features/card-security/server/post-charges"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"

export class ChargeLinkError extends Error {
  constructor(
    readonly code: "not_found" | "settled" | "wrong_mode" | "not_confirmed" | "intent_mismatch",
    message: string
  ) {
    super(message)
  }
}

/**
 * The charge behind a customer link (`/{locale}/pay/{token}`, C6b), with what
 * the page shows. The link works while the charge waits for the customer
 * (failed or needs authentication) and keeps working after the 90-day window
 * for charges created before it (Spec v2.1 §13).
 */
export async function loadChargeLink(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return null
  }

  const charge = await prisma.postCharge.findUnique({
    where: { paymentLinkToken: token },
    include: { transaction: { include: { vendor: true, cardSecurity: true, clientProfile: true } } },
  })

  if (!charge) {
    return null
  }

  return { charge, mode: linkKindFor(charge), paid: charge.status === "SUCCEEDED" || charge.status === "REFUNDED" || charge.status === "PARTIALLY_REFUNDED" }
}

async function requireLink(token: string, mode: "payment" | "card_update") {
  const link = await loadChargeLink(token)

  if (!link) {
    throw new ChargeLinkError("not_found", "This payment link does not exist.")
  }

  if (link.paid || !link.mode) {
    throw new ChargeLinkError("settled", "This charge is already settled.")
  }

  if (link.mode !== mode) {
    throw new ChargeLinkError("wrong_mode", "This link expects another step.")
  }

  const account = link.charge.transaction.vendor.stripeAccountId

  if (!account || !link.charge.paymentIntentId) {
    throw new ChargeLinkError("not_found", "This payment link cannot be used.")
  }

  return { ...link, account }
}

/**
 * Payment link: the same PaymentIntent, confirmed by the customer on session
 * (3D Secure if the bank asks), with the saved card or another one.
 */
export async function chargeLinkPaymentIntent(token: string) {
  const { charge, account } = await requireLink(token, "payment")
  const intent = await stripeGateway.payments.retrievePaymentIntent(charge.paymentIntentId!, { account })
  const card = charge.transaction.cardSecurity

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    stripeAccountId: account,
    savedCard: card?.status === "SECURED" && card.paymentMethodId ? { paymentMethodId: card.paymentMethodId, brand: card.cardBrand, last4: card.cardLast4 } : null,
  }
}

/** After the browser confirmed: reads the PaymentIntent at Stripe (never trusts the browser) and settles the charge. */
export async function confirmChargeLinkPayment(token: string) {
  const link = await loadChargeLink(token)

  if (!link?.charge.paymentIntentId || !link.charge.transaction.vendor.stripeAccountId) {
    throw new ChargeLinkError("not_found", "This payment link does not exist.")
  }

  if (link.paid) {
    return { status: "succeeded" as const }
  }

  const intent = await stripeGateway.payments.retrievePaymentIntent(link.charge.paymentIntentId, { account: link.charge.transaction.vendor.stripeAccountId })

  if (intent.metadata?.postChargeId !== link.charge.id) {
    throw new ChargeLinkError("intent_mismatch", "This payment does not belong to the charge.")
  }

  if (intent.status === "succeeded") {
    await applyPostChargeIntent(prisma, intent, "succeeded")
    return { status: "succeeded" as const }
  }

  if (intent.status === "processing") {
    return { status: "processing" as const }
  }

  throw new ChargeLinkError("not_confirmed", intent.last_payment_error?.message ?? "The payment did not go through. Please try again.")
}

/**
 * Card-update link (expired or wrong card number): the customer agrees again
 * to the card terms, then saves a new card with a SetupIntent.
 */
export async function startChargeLinkCardUpdate(token: string, request: { ip: string | null; userAgent: string | null }) {
  const { charge, account } = await requireLink(token, "card_update")
  const transaction = charge.transaction

  await recordCardConsent(prisma, {
    transaction: { id: transaction.id, externalRef: transaction.externalRef, locale: transaction.locale, vendor: transaction.vendor },
    ip: request.ip,
    userAgent: request.userAgent,
  })

  const customer = await ensurePartnerCustomer(prisma, stripeGateway, {
    vendorId: transaction.vendorId,
    stripeAccountId: account,
    email: transaction.clientProfile?.email ?? "",
    name: transaction.clientProfile?.fullName ?? null,
  })
  const intent = await stripeGateway.payments.createSetupIntent(
    {
      customer: customer.stripeCustomerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: { transactionId: transaction.id, postChargeId: charge.id, cardUpdate: "true" },
    },
    { account }
  )

  return { clientSecret: intent.client_secret, setupIntentId: intent.id, stripeAccountId: account }
}

/**
 * The new card is saved: it replaces the booking's card and the charge is
 * tried again at once, off session (Spec v2.1 §9: card-update link, then charge).
 */
export async function finishChargeLinkCardUpdate(token: string, setupIntentId: string) {
  const { charge, account } = await requireLink(token, "card_update")
  const intent: Stripe.SetupIntent = await stripeGateway.payments.retrieveSetupIntent(setupIntentId, { account })

  if (intent.metadata?.postChargeId !== charge.id) {
    throw new ChargeLinkError("intent_mismatch", "This card does not belong to the charge.")
  }

  const paymentMethodId = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id

  if (intent.status !== "succeeded" || !paymentMethodId) {
    throw new ChargeLinkError("not_confirmed", intent.last_setup_error?.message ?? "Your card could not be saved. Please try another card.")
  }

  const paymentMethod = await stripeGateway.payments.retrievePaymentMethod(paymentMethodId, { account })
  const previousPaymentMethodId = charge.transaction.cardSecurity?.paymentMethodId ?? null
  const card = await prisma.cardSecurity.update({
    where: { transactionId: charge.transactionId },
    data: {
      status: "SECURED",
      setupIntentId: intent.id,
      paymentMethodId,
      cardBrand: paymentMethod.card?.brand ?? null,
      cardLast4: paymentMethod.card?.last4 ?? null,
      cardExpMonth: paymentMethod.card?.exp_month ?? null,
      cardExpYear: paymentMethod.card?.exp_year ?? null,
      securedAt: new Date(),
    },
  })

  // The old card (expired or mistyped) is no use any more: detach it unless another booking still relies on it.
  if (previousPaymentMethodId && previousPaymentMethodId !== paymentMethodId) {
    const stillUsed = await prisma.cardSecurity.count({ where: { paymentMethodId: previousPaymentMethodId, status: "SECURED" } })

    if (stillUsed === 0) {
      await stripeGateway.payments.detachPaymentMethod(previousPaymentMethodId, { account }).catch(() => undefined)
    }
  }

  const { transaction, ...row } = charge
  const result = await attemptPostCharge(prisma, stripeGateway, { charge: row, card, account, reference: transaction.reference })
  return { status: result.status === "SUCCEEDED" ? ("succeeded" as const) : ("failed" as const), message: result.status === "SUCCEEDED" ? null : "The new card was declined." }
}
