import { createHash } from "node:crypto"

import { hasSecuredCard, isCardSecurityRequired } from "@/features/card-security/card-security-state"
import { ConsentPartiesMissingError, partnerCardConsentText } from "@/features/card-security/consent-texts"
import { CardSecurityError, findCardConsent, recordCardConsent } from "@/features/card-security/server/card-security"
import { loadClientCardSecurityContext } from "@/features/card-security/server/client-card-security"
import { buildPopulatedContractContent, canRevisitClientStep, clientFlowTransactionInclude, getClientFlowState, hasContractStep } from "@/features/client-flow/server/client-flow-data"
import { confirmClientCardSetup, startClientCardSetup } from "@/features/client-flow/server/steps/card-setup"
import { confirmClientPayment } from "@/features/client-flow/server/steps/confirm-payment"
import { reviewClientContract } from "@/features/client-flow/server/steps/review-contract"
import { signClientContract } from "@/features/client-flow/server/steps/sign-contract"
import { startClientIdentityVerification } from "@/features/client-flow/server/steps/start-identity"
import { startClientPayment } from "@/features/client-flow/server/steps/start-payment"
import { submitClientDocuments } from "@/features/client-flow/server/steps/submit-documents"
import { presentPartnerCheckout } from "@/features/partner-api/checkout-presenter"
import {
  CHECKOUT_FILE_MAX_BYTES,
  CHECKOUT_FILE_TYPES,
  partnerCheckoutDocumentFieldsSchema,
  type PartnerCheckoutCard,
  type PartnerCheckoutCardConsentInput,
  type PartnerCheckoutDocumentsSubmitInput,
  type PartnerCheckoutContract,
  type PartnerCheckoutIdentity,
  type PartnerCheckoutNextStep,
  type PartnerCheckoutPayment,
  type PartnerCheckoutSignatureInput,
  type PartnerCheckoutUploadedFile,
} from "@/features/partner-api/schemas/checkout.schema"
import { signCheckoutFile, verifyCheckoutFile } from "@/features/partner-api/server/checkout-files"
import { uploadCheckoutDocument } from "@/features/partner-api/server/checkout-upload"
import { assertReturnUrlAllowed, requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { normalizeRequirementFileCount } from "@/features/transactions/contract-flow"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { getStripePublishableKey } from "@/lib/integrations/stripe"
import { PartnerApiError, type PartnerApiErrorCode } from "@/lib/partner-api/errors"

/** Embedded checkout (M10): the partner drives the customer's steps on its own site; see the API README. */

type Caller = { vendorProfile: { id: string; partnerAllowedOrigins?: string[] } }

/** The booking as the customer flow sees it (same include as Contrazy's pages), for this vendor only. */
export async function loadCheckoutTransaction(caller: Caller, bookingId: string) {
  const booking = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })
  const transaction = await prisma.transaction.findUnique({ where: { id: booking.id }, include: clientFlowTransactionInclude })
  if (!transaction) throw new PartnerApiError("not_found", "No booking matches this reference for this vendor.")
  return transaction
}

/** `GET /bookings/:id/checkout`. */
export async function getPartnerCheckout(caller: Caller, bookingId: string) {
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}

type CheckoutTransaction = Awaited<ReturnType<typeof loadCheckoutTransaction>>

/** The booking's secure link, while the checkout is open (an expired link is closed on the way, as on Contrazy's pages). */
async function openLink(transaction: CheckoutTransaction) {
  if (!transaction.link) throw new PartnerApiError("checkout_closed", "This booking has no customer checkout.")
  const context = await getClientLinkAccessContext(transaction.link.token)
  if (context.state !== "active" || transaction.status === "CANCELLED") throw new PartnerApiError("checkout_closed", "This booking's checkout is closed (cancelled or expired).")
  return context.link
}

function assertDocumentsChangeable(transaction: CheckoutTransaction) {
  if (!canRevisitClientStep(transaction, "documents")) throw new PartnerApiError("step_not_available", "Documents can no longer be changed after payment has started.")
}

type UploadDeps = { secret: string; upload: typeof uploadCheckoutDocument; now?: Date }
const defaultUploadDeps = (): UploadDeps => ({ secret: env.JWT_ENCRYPTION_SECRET, upload: uploadCheckoutDocument })

/** `POST /bookings/:id/checkout/documents/files`: one file stored for a slot of a requirement; its signed fileId back. */
export async function uploadPartnerCheckoutFile(caller: Caller, bookingId: string, form: FormData, deps: UploadDeps = defaultUploadDeps()): Promise<PartnerCheckoutUploadedFile> {
  const fields = partnerCheckoutDocumentFieldsSchema.safeParse({ requirementId: form.get("requirementId"), slotIndex: form.get("slotIndex") })
  if (!fields.success) throw new PartnerApiError("invalid_request", fields.error.issues[0]?.message ?? "requirementId and slotIndex are required.")
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) throw new PartnerApiError("invalid_file", "Send the document as the multipart field `file`.")
  if (!(CHECKOUT_FILE_TYPES as readonly string[]).includes(file.type)) throw new PartnerApiError("invalid_file", "Send a JPEG, PNG, WebP, HEIC or PDF file.")
  if (file.size > CHECKOUT_FILE_MAX_BYTES) throw new PartnerApiError("invalid_file", "The file is larger than 10 MB.")

  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  assertDocumentsChangeable(transaction)
  const requirement = transaction.requirements.find((item) => item.id === fields.data.requirementId)
  if (!requirement || requirement.type === "TEXT") throw new PartnerApiError("invalid_request", "No document requirement matches this requirementId on this booking.")
  if (fields.data.slotIndex >= normalizeRequirementFileCount(requirement.type, requirement.requiredFileCount)) throw new PartnerApiError("invalid_request", "slotIndex is outside this requirement's files.")

  const fileName = file.name || "document"
  const stored = await deps.upload({ bytes: Buffer.from(await file.arrayBuffer()), fileName, pdf: file.type === "application/pdf" }, link.token)
  const fileId = signCheckoutFile({ bookingId: transaction.id, requirementId: requirement.id, slotIndex: fields.data.slotIndex, publicId: stored.publicId, secureUrl: stored.secureUrl, fileName }, deps.secret, deps.now)
  return { fileId, requirementId: requirement.id, slotIndex: fields.data.slotIndex, fileName }
}

const STEP_REFUSALS: Record<number, PartnerApiErrorCode> = { 400: "invalid_request", 404: "not_found", 409: "step_not_available", 410: "checkout_closed" }

/** `POST /bookings/:id/checkout/documents`: every file of the step at once, through the documents step of Contrazy's pages. */
export async function submitPartnerCheckoutDocuments(caller: Caller, bookingId: string, input: PartnerCheckoutDocumentsSubmitInput, secret = env.JWT_ENCRYPTION_SECRET) {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  assertDocumentsChangeable(transaction)

  const documents = input.files.map((entry) => {
    const file = verifyCheckoutFile(entry.fileId, transaction.id, secret)
    if (!file || file.requirementId !== entry.requirementId || file.slotIndex !== entry.slotIndex) throw new PartnerApiError("invalid_request", "A fileId is unknown, expired, or belongs to another booking or slot.")
    const requirement = transaction.requirements.find((item) => item.id === file.requirementId)
    return { requirementId: file.requirementId, type: requirement?.type, slotIndex: file.slotIndex, source: "UPLOAD" as const, secure_url: file.secureUrl, public_id: file.publicId, original_filename: file.fileName ?? undefined }
  })

  const result = await submitClientDocuments(link, documents)
  if (result.status !== 200) throw new PartnerApiError(STEP_REFUSALS[result.status] ?? "invalid_request", result.body.message ?? "The documents were refused.")
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}

/**
 * `POST /bookings/:id/checkout/identity`: Stripe Identity for the booking, as Contrazy's page starts it; the partner
 * opens Stripe's modal with `clientSecret` (Contrazy's publishable key), or sends the customer to `url`, which comes
 * back to `returnUrl` (one of the vendor's allowed origins).
 */
export async function startPartnerCheckoutIdentity(caller: Caller, bookingId: string, input: { returnUrl: string }): Promise<PartnerCheckoutIdentity> {
  assertReturnUrlAllowed(input.returnUrl, caller.vendorProfile.partnerAllowedOrigins ?? [])
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  const result = await startClientIdentityVerification(link.id, link.token, { returnUrl: input.returnUrl })
  if (result.status === 409) throw new PartnerApiError("step_not_available", result.body.message ?? "Identity details can no longer be changed after payment has started.")
  if (result.status === 422) throw new PartnerApiError("plan_feature_unavailable", result.body.message ?? "Identity verification is not available for this vendor.")
  if (result.status === 404) throw new PartnerApiError("not_found", result.body.message ?? "No booking matches this reference for this vendor.")
  if (result.status !== 200 || !result.body.clientSecret || !result.body.url) throw new Error(result.body.message ?? "The identity check could not start.")
  return { clientSecret: result.body.clientSecret, url: result.body.url, publishableKey: getStripePublishableKey() }
}

/** The populated agreement and its version: a hash of exactly what the customer reads. */
function checkoutContract(transaction: CheckoutTransaction): PartnerCheckoutContract {
  if (!hasContractStep(transaction)) throw new PartnerApiError("step_not_available", "This booking has no contract to sign.")
  const html = buildPopulatedContractContent(transaction)
  return { html, version: `v_${createHash("sha256").update(html).digest("hex").slice(0, 32)}`, locale: transaction.locale }
}

/** `GET /bookings/:id/checkout/contract`: the agreement to show on the partner's page. */
export async function getPartnerCheckoutContract(caller: Caller, bookingId: string): Promise<PartnerCheckoutContract> {
  return checkoutContract(await loadCheckoutTransaction(caller, bookingId))
}

function stepRefusal(result: { status: number; body: { message?: string } }, fallback: string): PartnerApiError {
  return new PartnerApiError(STEP_REFUSALS[result.status] ?? "invalid_request", result.body.message ?? fallback)
}

/** `POST /bookings/:id/checkout/contract/accept`: the customer read this version; a changed contract is refused. */
export async function acceptPartnerCheckoutContract(caller: Caller, bookingId: string, input: { version: string }) {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  if (checkoutContract(transaction).version !== input.version) throw new PartnerApiError("version_mismatch", "The contract changed since the customer read it: show it again.")
  const result = await reviewClientContract(link)
  if (result.status !== 200) throw stepRefusal(result, "The contract review was refused.")
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}

/** `POST /bookings/:id/checkout/signature`: the accepted contract signed, with the customer's IP as evidence. */
export async function signPartnerCheckout(caller: Caller, bookingId: string, input: PartnerCheckoutSignatureInput, ipAddress: string | null) {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  checkoutContract(transaction)
  if (!getClientFlowState(transaction).reviewedContract) throw new PartnerApiError("step_not_available", "Accept the contract before signing it.")
  const result = await signClientContract(
    link.id,
    { signatureDataUrl: input.image, signedTimezone: input.timezone, signatureMethod: input.method, typedValue: input.typedName ?? null, fontKey: input.font ?? null, signatureCity: input.city },
    ipAddress
  )
  if (result.status !== 200) throw stepRefusal(result, "The signature was refused.")
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}

/** The money steps follow Contrazy's order: refused while the checkout is on another step. */
function assertCurrentStep(transaction: CheckoutTransaction, step: PartnerCheckoutNextStep, message: string) {
  const current = presentPartnerCheckout(transaction).nextStep
  if (current !== step) throw new PartnerApiError("step_not_available", `${message} The checkout is on \`${current}\`.`)
}

/** A PaymentIntent or SetupIntent id Stripe does not know on the vendor's account. */
function unknownIntent(error: unknown) {
  return (error as { code?: string } | null)?.code === "resource_missing"
}

const CONSENT_FIRST = "Record the customer's card consent (`card/consent`) first: this booking keeps the card for later charges."

/**
 * `POST /bookings/:id/checkout/payment`: the PaymentIntent of the next money stage (the deposit hold or charge, then the
 * rental payment, which also saves the card when the booking keeps it), created as on Contrazy's page. The partner
 * confirms it in the browser with Stripe.js on the vendor's connected account.
 */
export async function startPartnerCheckoutPayment(caller: Caller, bookingId: string): Promise<PartnerCheckoutPayment> {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  assertCurrentStep(transaction, "payment", "Nothing is to be paid now.")

  let result: Awaited<ReturnType<typeof startClientPayment>>
  try {
    result = await startClientPayment({ link }, link.token)
  } catch (error) {
    if (error instanceof CardSecurityError) throw new PartnerApiError("invalid_request", error.message)
    throw error
  }
  const { body } = result
  if (body.code === "consent_required") throw new PartnerApiError("consent_required", CONSENT_FIRST)
  if (result.status === 422) throw new PartnerApiError("stripe_not_connected", "The vendor's Stripe account is not ready to take payments.")
  if (result.status !== 200 || body.redirect || !body.clientSecret || !body.stripeAccountId || !body.publishableKey || body.amountCents === undefined || !body.currency) {
    throw new PartnerApiError("step_not_available", "Nothing is to be paid now.")
  }

  return {
    stage: body.isDeposit ? "deposit" : "rental",
    clientSecret: body.clientSecret,
    stripeAccountId: body.stripeAccountId,
    publishableKey: body.publishableKey,
    amount: body.amountCents,
    currency: body.currency.toLowerCase(),
    deposit: body.isDeposit ? { method: body.depositStrategy === "CHARGE_REFUND" ? "charge" : "hold", days: body.depositHoldDays ?? 7 } : null,
  }
}

/** `POST /bookings/:id/checkout/payment/confirm`: the PaymentIntent read at Stripe and recorded; the checkout state back. */
export async function confirmPartnerCheckoutPayment(caller: Caller, bookingId: string, input: { paymentIntentId: string }) {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)

  let result: Awaited<ReturnType<typeof confirmClientPayment>>
  try {
    result = await confirmClientPayment(link.id, input.paymentIntentId)
  } catch (error) {
    if (unknownIntent(error)) throw new PartnerApiError("invalid_request", "No PaymentIntent matches this id on the vendor's account.")
    throw error
  }
  if (result.status === 403) throw new PartnerApiError("invalid_request", "This PaymentIntent belongs to another booking.")
  if (result.status === 422) throw new PartnerApiError("payment_failed", result.body.message ?? "The payment was not successful.")
  if (result.status !== 200) throw stepRefusal(result, "The payment could not be confirmed.")
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}

/**
 * `POST /bookings/:id/checkout/card/consent`: the customer's consent to later charges on the saved card, in the exact
 * words the partner showed (French and English), with the customer's IP and browser. Before the rental payment that
 * saves the card, or before `/card`. Once recorded, or once the card is saved, calling it again changes nothing.
 */
export async function recordPartnerCheckoutCardConsent(
  caller: Caller,
  bookingId: string,
  input: PartnerCheckoutCardConsentInput,
  evidence: { ip: string | null; userAgent: string | null }
) {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  await openLink(transaction)
  if (!isCardSecurityRequired(transaction)) throw new PartnerApiError("step_not_available", "This booking does not keep a card.")

  if (!hasSecuredCard(transaction) && !(await findCardConsent(prisma, transaction.id))) {
    try {
      await recordCardConsent(prisma, {
        transaction: { id: transaction.id, externalRef: transaction.externalRef, locale: transaction.locale, vendor: transaction.vendor },
        ip: evidence.ip,
        userAgent: evidence.userAgent,
        text: partnerCardConsentText({ version: input.consentVersion, fr: input.textFr, en: input.textEn }),
      })
    } catch (error) {
      if (error instanceof ConsentPartiesMissingError) throw new PartnerApiError("step_requires_configuration", error.message)
      throw error
    }
  }

  return presentPartnerCheckout(transaction)
}

/** The card-security context of Contrazy's routes, its refusals as partner errors. */
async function cardContext(token: string) {
  const context = await loadClientCardSecurityContext(token)
  if (!context.error) return context
  const status = context.error.status
  if (status === 422) throw new PartnerApiError("stripe_not_connected", "The vendor's Stripe account is not ready to save cards.")
  if (status === 409) throw new PartnerApiError("step_not_available", "This booking does not keep a card.")
  throw new PartnerApiError(STEP_REFUSALS[status] ?? "invalid_request", "This booking's card cannot be saved.")
}

/**
 * `POST /bookings/:id/checkout/card`: the card saved on its own, when nothing is charged now (consent first). The
 * partner confirms the SetupIntent in the browser with Stripe.js on the vendor's connected account.
 */
export async function startPartnerCheckoutCard(caller: Caller, bookingId: string): Promise<PartnerCheckoutCard> {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)
  assertCurrentStep(transaction, "card", "The card is saved on its own only once nothing is left to pay.")

  const result = await startClientCardSetup(await cardContext(link.token))
  if (result.body.code === "consent_required") throw new PartnerApiError("consent_required", CONSENT_FIRST)
  if (result.status === 422) throw new PartnerApiError("invalid_request", result.body.message ?? "The customer's e-mail is needed to save a card.")
  if (result.body.next || !result.body.clientSecret || !result.body.stripeAccountId || !result.body.publishableKey) {
    throw new PartnerApiError("step_not_available", "No card is to be saved now.")
  }
  return { clientSecret: result.body.clientSecret, stripeAccountId: result.body.stripeAccountId, publishableKey: result.body.publishableKey }
}

/** `POST /bookings/:id/checkout/card/confirm`: the SetupIntent read at Stripe, the card marked saved; the checkout state back. */
export async function confirmPartnerCheckoutCard(caller: Caller, bookingId: string, input: { setupIntentId: string }) {
  const transaction = await loadCheckoutTransaction(caller, bookingId)
  const link = await openLink(transaction)

  let result: Awaited<ReturnType<typeof confirmClientCardSetup>>
  try {
    result = await confirmClientCardSetup(await cardContext(link.token), input.setupIntentId)
  } catch (error) {
    if (unknownIntent(error)) throw new PartnerApiError("invalid_request", "No SetupIntent matches this id on the vendor's account.")
    throw error
  }
  if (result.status === 403) throw new PartnerApiError("invalid_request", "This SetupIntent belongs to another booking.")
  if (result.status === 422) throw new PartnerApiError("payment_failed", result.body.message ?? "The card could not be saved.")
  if (result.body.code === "consent_required") throw new PartnerApiError("consent_required", CONSENT_FIRST)
  if (result.status !== 200) throw new PartnerApiError("invalid_request", result.body.message ?? "The card could not be confirmed.")
  return presentPartnerCheckout(await loadCheckoutTransaction(caller, bookingId))
}
