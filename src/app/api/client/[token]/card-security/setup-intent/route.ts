import { NextResponse } from "next/server"

import { CardSecurityError, ensurePartnerCustomer, findCardConsent, startCardSetup } from "@/features/card-security/server/card-security"
import { loadClientCardSecurityContext } from "@/features/card-security/server/client-card-security"
import { prisma } from "@/lib/db/prisma"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"
import { getStripePublishableKey, stripeGateway } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * "Card as security only" (Spec v2.1 §4): a SetupIntent with usage
 * off_session on the vendor's connected account, for the customer's Stripe
 * customer. Only after consent (409 consent_required otherwise).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const context = await loadClientCardSecurityContext(token)

    if ("error" in context) {
      return context.error
    }

    const { transaction, stripeAccountId, financeStage } = context

    if (financeStage !== "card_security") {
      const next = financeStage === "complete" ? "complete" : "payment"
      return NextResponse.json({ success: true, redirect: withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/${next}`) })
    }

    const consent = await findCardConsent(prisma, transaction.id)

    if (!consent) {
      return NextResponse.json({ success: false, code: "consent_required", message: "Please accept the card terms first." }, { status: 409 })
    }

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

    return NextResponse.json({
      success: true,
      clientSecret: intent.client_secret,
      setupIntentId: intent.id,
      stripeAccountId,
      publishableKey: getStripePublishableKey(),
    })
  } catch (error) {
    if (error instanceof CardSecurityError && error.code === "customer_email_missing") {
      return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: 422 })
    }

    console.error("Card setup intent error", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Failed to initialize the card form" }, { status: 500 })
  }
}
