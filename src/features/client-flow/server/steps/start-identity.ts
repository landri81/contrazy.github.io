import { canRevisitClientStep, clientFlowTransactionInclude } from "@/features/client-flow/server/client-flow-data"
import { buildIdentityVerificationSessionParams, SELFIE_NOT_REQUESTED } from "@/features/kyc/selfie-check"
import { canUseKyc, getKycProvider, remainingKycVerifications } from "@/features/subscriptions/server/feature-gates"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"
import { getAppBaseUrl, stripeGateway } from "@/lib/integrations/stripe"

/**
 * The identity step's start (shared, M10): a Stripe Identity session on the platform account for the booking's link,
 * as Contrazy's page starts it and as the partner API's embedded checkout does. The page sends the customer to the
 * hosted check (`url`); a partner opens Stripe's modal on its own site (`clientSecret`) and may bring the hosted check
 * back to its page (`returnUrl`, an allowed origin checked by the caller).
 */

export type IdentityStartResult = { status: number; body: { success: boolean; message?: string; url?: string; clientSecret?: string | null } }

export async function startClientIdentityVerification(linkId: string, token: string, options: { returnUrl?: string } = {}): Promise<IdentityStartResult> {
  const link = await prisma.transactionLink.findUnique({
    where: { id: linkId },
    include: { transaction: true },
  })

  if (!link?.transaction) {
    return { status: 404, body: { success: false, message: "Transaction not found." } }
  }

  const { transaction } = link
  const currentTransaction = await prisma.transaction.findUnique({
    where: { id: transaction.id },
    include: clientFlowTransactionInclude,
  })

  if (!currentTransaction) {
    return { status: 404, body: { success: false, message: "Transaction not found." } }
  }

  if (!canRevisitClientStep(currentTransaction, "kyc")) {
    return { status: 409, body: { success: false, message: "Identity details can no longer be changed after payment has started." } }
  }

  const locale = normalizeLocale(transaction.locale)

  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId: transaction.vendorId },
  })

  if (!canUseKyc(subscription)) {
    return { status: 422, body: { success: false, message: "Identity verification is not available for this vendor." } }
  }

  if (getKycProvider(subscription) !== "stripe_identity") {
    return { status: 422, body: { success: false, message: "Stripe Identity is not available on this plan." } }
  }

  const remaining = remainingKycVerifications(subscription)
  if (remaining !== null && remaining <= 0) {
    return { status: 422, body: { success: false, message: "The vendor has reached the KYC quota for this billing period." } }
  }

  const baseUrl = getAppBaseUrl()

  // Plain return URL — no Stripe template variable. The session ID is stored in
  // the database at creation so the return page and webhooks can look it up
  // without depending on URL parameters (the {VERIFICATION_SESSION_ID} placeholder
  // is only substituted by Stripe in mobile SDKs, not the hosted web redirect).
  const returnUrl = options.returnUrl ?? `${baseUrl}${withLocalePath(locale, `/t/${token}/kyc/return`)}`

  // Create the VerificationSession on the PLATFORM Stripe account.
  // Stripe Identity is platform-level; the vendor's Connect account is for payments
  // and may not have Identity permissions granted.
  // With `requireSelfie` the session also asks for a live selfie matched against
  // the photo ID; otherwise the parameters are unchanged.
  const session = await stripeGateway.identity.createVerificationSession(
    buildIdentityVerificationSessionParams({
      returnUrl,
      metadata: {
        transactionId: transaction.id,
        vendorId: transaction.vendorId,
        token,
      },
      requireSelfie: transaction.requireSelfie,
    })
  )

  if (!session.url) {
    return { status: 500, body: { success: false, message: "Failed to create verification session." } }
  }

  // Store session ID immediately so the return page never needs to trust URL params.
  // Upsert handles the case where the customer starts a new session after a failure.
  await prisma.$transaction(async (tx) => {
    await tx.kycVerification.upsert({
      where: { transactionId: transaction.id },
      create: {
        transactionId: transaction.id,
        provider: "Stripe Identity",
        status: "PENDING",
        providerReference: session.id,
      },
      update: {
        status: "PENDING",
        providerReference: session.id,
        verifiedAt: null,
        summary: null,
        ...SELFIE_NOT_REQUESTED,
      },
    })

    await recordTransactionEvent(tx, {
      transactionId: transaction.id,
      type: "KYC_STARTED",
      title: "Identity verification started",
      detail: transaction.requireSelfie
        ? "Customer redirected to Stripe Identity for document and selfie verification."
        : "Customer redirected to Stripe Identity for document verification.",
      dedupeKey: `event:kyc-started:${transaction.id}:${session.id}`,
    })
  })

  return { status: 200, body: { success: true, url: session.url, clientSecret: session.client_secret ?? null } }
}
