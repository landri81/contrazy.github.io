import { createHash } from "node:crypto"
import type { CardSecurity, ConsentRecord, PartnerCustomer, Prisma, PrismaClient } from "@prisma/client"
import type Stripe from "stripe"

import { consentPartiesFor, CURRENT_CARD_CONSENT_VERSION, renderCardConsentText, type RenderedConsentText } from "@/features/card-security/consent-texts"
import { recordCardSecuredEvent } from "@/features/partner-webhooks/server/charge-events"
import type { StripeGateway } from "@/lib/integrations/stripe-gateway"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

export class CardSecurityError extends Error {
  constructor(
    readonly code: "consent_required" | "customer_email_missing" | "card_not_saved" | "intent_mismatch",
    message: string
  ) {
    super(message)
  }
}

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase()
}

/**
 * The vendor's Stripe customer for this client, created once and reused for
 * every later booking (Spec v2.1 §4, PRD §4.4). The Stripe call carries an
 * idempotency key per vendor and e-mail, so two concurrent first bookings get
 * the same customer; the unique (vendorId, email) row settles the race in our
 * database.
 */
export async function ensurePartnerCustomer(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: { vendorId: string; stripeAccountId: string; email: string; name?: string | null; phone?: string | null }
): Promise<PartnerCustomer> {
  const email = normalizeCustomerEmail(input.email)

  if (!email) {
    throw new CardSecurityError("customer_email_missing", "The customer's e-mail is needed to save a card.")
  }

  const existing = await db.partnerCustomer.findUnique({ where: { vendorId_email: { vendorId: input.vendorId, email } } })

  if (existing) {
    return existing
  }

  const emailKey = createHash("sha256").update(email).digest("hex").slice(0, 32)
  const customer = await gateway.payments.createCustomer(
    {
      email,
      name: input.name ?? undefined,
      phone: input.phone ?? undefined,
      metadata: { contrazyVendorId: input.vendorId },
    },
    { account: input.stripeAccountId, idempotencyKey: `partner-customer:${input.vendorId}:${emailKey}` }
  )

  try {
    return await db.partnerCustomer.create({
      data: { vendorId: input.vendorId, email, name: input.name ?? null, phone: input.phone ?? null, stripeCustomerId: customer.id },
    })
  } catch (error) {
    // Lost the race to a concurrent first booking: its row has the same customer (same idempotency key).
    const winner = await db.partnerCustomer.findUnique({ where: { vendorId_email: { vendorId: input.vendorId, email } } })

    if (winner) {
      return winner
    }

    throw error
  }
}

type ConsentTransaction = {
  id: string
  externalRef: string | null
  locale: string
  vendor: { businessName: string | null; supportEmail: string | null; businessEmail: string | null }
}

/** The consent text this transaction's customer sees (Spec §6), rendered with the vendor's name and contact. */
export function consentTextFor(transaction: Pick<ConsentTransaction, "vendor">) {
  return renderCardConsentText(consentPartiesFor(transaction.vendor), CURRENT_CARD_CONSENT_VERSION)
}

/**
 * Logs the customer's consent with the exact text shown, its version and hash,
 * IP and browser (Spec v2.1 §6, §14). Written server-side before any card form
 * is shown, so no card is ever saved without it. Never updated. `text` is the
 * partner's own wording when its checkout showed it (M10); Contrazy's otherwise.
 */
export async function recordCardConsent(
  db: DatabaseClient,
  input: { transaction: ConsentTransaction; ip: string | null; userAgent: string | null; text?: RenderedConsentText }
): Promise<ConsentRecord> {
  const text = input.text ?? consentTextFor(input.transaction)

  return db.consentRecord.create({
    data: {
      transactionId: input.transaction.id,
      termsVersion: text.version,
      textFr: text.fr,
      textEn: text.en,
      textHash: text.hash,
      locale: input.transaction.locale,
      ip: input.ip?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      externalRef: input.transaction.externalRef,
    },
  })
}

export function findCardConsent(db: DatabaseClient, transactionId: string) {
  return db.consentRecord.findFirst({ where: { transactionId }, orderBy: { consentAt: "desc" } })
}

/** Client IP from the proxy headers (Vercel sets x-forwarded-for; the first entry is the client). */
export function clientIpFrom(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || null
}

/**
 * The pending card-security row of a transaction, attached to the customer and
 * to the intent that will save the card. One row per transaction: a new
 * intent (retry after a refused card) replaces the previous intent id.
 */
export async function trackPendingCardSecurity(
  db: DatabaseClient,
  input: { transactionId: string; partnerCustomer: PartnerCustomer; setupIntentId?: string; paymentIntentId?: string }
): Promise<CardSecurity> {
  const intent = { setupIntentId: input.setupIntentId ?? null, paymentIntentId: input.paymentIntentId ?? null }

  return db.cardSecurity.upsert({
    where: { transactionId: input.transactionId },
    create: {
      transactionId: input.transactionId,
      partnerCustomerId: input.partnerCustomer.id,
      stripeCustomerId: input.partnerCustomer.stripeCustomerId,
      ...intent,
    },
    update: { partnerCustomerId: input.partnerCustomer.id, stripeCustomerId: input.partnerCustomer.stripeCustomerId, ...intent },
  })
}

/**
 * SetupIntent for "card as security only" (nothing charged now, Spec §4). A
 * still-unconfirmed intent of this transaction is reused, so reloading the page
 * does not pile up intents at Stripe.
 */
export async function startCardSetup(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: { transactionId: string; stripeAccountId: string; partnerCustomer: PartnerCustomer; termsVersion: string; reference: string }
): Promise<Stripe.SetupIntent> {
  const call = { account: input.stripeAccountId }
  const current = await db.cardSecurity.findUnique({ where: { transactionId: input.transactionId } })

  if (current?.setupIntentId && current.status === "PENDING" && current.stripeCustomerId === input.partnerCustomer.stripeCustomerId) {
    const reusable = await gateway.payments.retrieveSetupIntent(current.setupIntentId, call)

    if (reusable.status === "requires_payment_method" || reusable.status === "requires_confirmation" || reusable.status === "requires_action") {
      return reusable
    }
  }

  const intent = await gateway.payments.createSetupIntent(
    {
      customer: input.partnerCustomer.stripeCustomerId,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: { transactionId: input.transactionId, reference: input.reference, termsVersion: input.termsVersion, cardSecurity: "true" },
    },
    call
  )

  await trackPendingCardSecurity(db, { transactionId: input.transactionId, partnerCustomer: input.partnerCustomer, setupIntentId: intent.id })
  return intent
}

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null)
}

/**
 * Marks the card saved once Stripe confirms it (SetupIntent succeeded, or the
 * rental PaymentIntent succeeded with `setup_future_usage`). Requires the
 * consent row: a card saved without it is never usable for later charges.
 * Card brand, last4 and expiry are copied for display only. Idempotent; the
 * CARD_SECURED event (and the partner webhook) is written in the same
 * database transaction.
 */
export async function markCardSecured(
  db: PrismaClient,
  gateway: StripeGateway,
  input: { transactionId: string; stripeAccountId: string; intent: Stripe.SetupIntent | Stripe.PaymentIntent }
): Promise<CardSecurity> {
  const { intent } = input
  const security = await db.cardSecurity.findUnique({ where: { transactionId: input.transactionId } })
  const intentField = intent.object === "setup_intent" ? security?.setupIntentId : security?.paymentIntentId

  if (!security || intentField !== intent.id || idOf(intent.customer) !== security.stripeCustomerId) {
    throw new CardSecurityError("intent_mismatch", "This intent does not belong to the transaction's card security.")
  }

  if (security.status === "SECURED") {
    return security
  }

  const paymentMethodId = idOf(intent.payment_method)

  if (!paymentMethodId) {
    throw new CardSecurityError("card_not_saved", "Stripe has not saved a card on this intent.")
  }

  if (!(await findCardConsent(db, input.transactionId))) {
    throw new CardSecurityError("consent_required", "No consent is recorded for this transaction.")
  }

  const paymentMethod = await gateway.payments.retrievePaymentMethod(paymentMethodId, { account: input.stripeAccountId })
  const securedAt = new Date()

  return db.$transaction(async (tx) => {
    const updated = await tx.cardSecurity.update({
      where: { id: security.id },
      data: {
        status: "SECURED",
        paymentMethodId,
        cardBrand: paymentMethod.card?.brand ?? null,
        cardLast4: paymentMethod.card?.last4 ?? null,
        cardExpMonth: paymentMethod.card?.exp_month ?? null,
        cardExpYear: paymentMethod.card?.exp_year ?? null,
        securedAt,
      },
    })

    await recordCardSecuredEvent(tx, { transactionId: input.transactionId, occurredAt: securedAt })
    return updated
  })
}

/** Why Stripe refused the card when saving it, for the customer (the decline message Stripe wrote for end users). */
export function setupFailureMessage(intent: Stripe.SetupIntent) {
  return intent.last_setup_error?.message ?? null
}
