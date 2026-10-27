import { createHash } from "node:crypto"

import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Embedded checkout, payment and card (M10, C7/C8): Contrazy's own payment steps behind the partner routes, in the
 * order of its pages; the consent in the partner's words before any card is saved; refusals as partner errors.
 */

const findTransaction = vi.fn()
const linkContext = vi.fn()
const startPayment = vi.fn()
const confirmPayment = vi.fn()
const startCard = vi.fn()
const confirmCard = vi.fn()
const cardContext = vi.fn()
const findConsent = vi.fn()
const recordConsent = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: { JWT_ENCRYPTION_SECRET: "s".repeat(40) } }))
vi.mock("@/lib/integrations/resend", () => ({}))
vi.mock("@/lib/integrations/stripe", () => ({ getStripePublishableKey: () => "pk_test_platform" }))
vi.mock("@/lib/integrations/cloudinary", () => ({ cloudinary: {} }))
vi.mock("@/lib/db/prisma", () => ({ prisma: { transaction: { findUnique: (...a: unknown[]) => findTransaction(...a) } } }))
vi.mock("@/features/partner-api/server/partner-bookings", () => ({ requirePartnerBooking: async (_vendorId: string, where: { id: string }) => ({ id: where.id }), assertReturnUrlAllowed: () => undefined }))
vi.mock("@/features/transactions/server/transaction-links", () => ({ getClientLinkAccessContext: (...a: unknown[]) => linkContext(...a) }))
vi.mock("@/features/client-flow/server/steps/review-contract", () => ({ reviewClientContract: vi.fn() }))
vi.mock("@/features/client-flow/server/steps/sign-contract", () => ({ signClientContract: vi.fn() }))
vi.mock("@/features/client-flow/server/steps/start-identity", () => ({ startClientIdentityVerification: vi.fn() }))
vi.mock("@/features/client-flow/server/steps/submit-documents", () => ({ submitClientDocuments: vi.fn() }))
vi.mock("@/features/client-flow/server/steps/start-payment", () => ({ startClientPayment: (...a: unknown[]) => startPayment(...a) }))
vi.mock("@/features/client-flow/server/steps/confirm-payment", () => ({ confirmClientPayment: (...a: unknown[]) => confirmPayment(...a) }))
vi.mock("@/features/client-flow/server/steps/card-setup", () => ({
  startClientCardSetup: (...a: unknown[]) => startCard(...a),
  confirmClientCardSetup: (...a: unknown[]) => confirmCard(...a),
}))
vi.mock("@/features/card-security/server/client-card-security", () => ({ loadClientCardSecurityContext: (...a: unknown[]) => cardContext(...a) }))
vi.mock("@/features/card-security/server/card-security", () => ({
  CardSecurityError: class CardSecurityError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message)
    }
  },
  findCardConsent: (...a: unknown[]) => findConsent(...a),
  recordCardConsent: (...a: unknown[]) => recordConsent(...a),
}))

const { confirmPartnerCheckoutCard, confirmPartnerCheckoutPayment, recordPartnerCheckoutCardConsent, startPartnerCheckoutCard, startPartnerCheckoutPayment } = await import("./partner-checkout")
const { CardSecurityError } = await import("@/features/card-security/server/card-security")
const { PartnerApiError } = await import("@/lib/partner-api/errors")

const caller = { vendorProfile: { id: "vendor_locaz", partnerAllowedOrigins: ["https://www.locaz.co"] } }
const code = async (run: Promise<unknown>) => run.then(() => "accepted", (error) => (error instanceof PartnerApiError ? error.code : String(error)))
const VENDOR = { businessName: "SAS LOCAZ", supportEmail: "contact@locaz.test", businessEmail: null, stripeAccountId: "acct_vendor" }
const CONSENT = { consentVersion: "card-90d-v3", textFr: "J'autorise SAS LOCAZ à débiter ma carte enregistrée.", textEn: "I authorise SAS LOCAZ to charge my saved card." }
const EVIDENCE = { ip: "203.0.113.9", userAgent: "Mozilla/5.0 (iPhone)" }
// Synthetic customer, profile complete (as a partner booking with address, birth date and birth place).
const PROFILE = { firstName: "Lina", lastName: "Martin", fullName: "Lina Martin", email: "lina@locaz.test", phone: "+33612345678", address: "12 rue de France, 06000 Nice", country: "FR", birthCity: "Nice", birthDate: new Date("1988-05-20"), companyName: null }

/** A booking at the payment step: no documents, identity or contract asked; a rental payment and a kept card. */
function transaction(patch: Record<string, unknown> = {}) {
  return {
    id: "tx_1",
    status: "LINK_SENT",
    locale: "fr",
    currency: "EUR",
    amount: 15_700,
    depositAmount: 0,
    externalRef: "LZ-2026-000200",
    requiresKyc: false,
    requireSelfie: false,
    requireClientCompany: false,
    stepSwitches: { identity: false, documents: false, contract: false, payment: true, cardSecurity: true },
    flowType: "STANDARD",
    clientProfileId: "cp_1",
    clientProfile: PROFILE,
    vendor: VENDOR,
    link: { token: "tok_1", status: "ACTIVE", expiresAt: null },
    requirements: [],
    documents: [],
    customFields: [],
    kycVerification: null,
    contractTemplateId: null,
    contractTemplate: null,
    contractArtifact: null,
    signatureRecord: null,
    events: [],
    payments: [],
    depositAuthorization: null,
    cardSecurity: null,
    reportFields: [],
    reports: [],
    servicePaymentRequestedAt: null,
    ...patch,
  }
}

/** Nothing left to pay: the card is saved on its own. */
const cardOnly = (patch: Record<string, unknown> = {}) => transaction({ amount: 0, ...patch })

const paymentStarted = {
  status: 200,
  body: { success: true, clientSecret: "pi_1_secret_x", stripeAccountId: "acct_vendor", publishableKey: "pk_test_platform", amountCents: 15_700, currency: "EUR", isDeposit: false, paymentIntentId: "pi_1" },
}

beforeEach(() => {
  vi.clearAllMocks()
  findTransaction.mockResolvedValue(transaction())
  linkContext.mockResolvedValue({ state: "active", link: { id: "link_1", token: "tok_1", transaction: { id: "tx_1" } } })
  startPayment.mockResolvedValue(paymentStarted)
  confirmPayment.mockResolvedValue({ status: 200, body: { success: true, status: "confirmed", nextStep: "complete" } })
  cardContext.mockResolvedValue({ transaction: { id: "tx_1" }, stripeAccountId: "acct_vendor", financeStage: "card_security" })
  startCard.mockResolvedValue({ status: 200, body: { success: true, clientSecret: "seti_1_secret_x", setupIntentId: "seti_1", stripeAccountId: "acct_vendor", publishableKey: "pk_test_platform" } })
  confirmCard.mockResolvedValue({ status: 200, body: { success: true, status: "confirmed", nextStep: "complete" } })
  findConsent.mockResolvedValue(null)
  recordConsent.mockResolvedValue({ id: "consent_1" })
})

describe("payment", () => {
  it("starts the next money stage through Contrazy's own step and answers what Stripe.js needs", async () => {
    expect(await startPartnerCheckoutPayment(caller, "tx_1")).toEqual({ stage: "rental", clientSecret: "pi_1_secret_x", stripeAccountId: "acct_vendor", publishableKey: "pk_test_platform", amount: 15_700, currency: "eur", deposit: null })
    expect(startPayment).toHaveBeenCalledWith({ link: expect.objectContaining({ id: "link_1" }) }, "tok_1")

    // The deposit says whether it is held on the card or charged and refunded (long deposits).
    startPayment.mockResolvedValue({ ...paymentStarted, body: { ...paymentStarted.body, isDeposit: true, amountCents: 80_000, depositStrategy: "AUTHORIZATION_HOLD", depositHoldDays: 7 } })
    expect(await startPartnerCheckoutPayment(caller, "tx_1")).toMatchObject({ stage: "deposit", amount: 80_000, deposit: { method: "hold", days: 7 } })
    startPayment.mockResolvedValue({ ...paymentStarted, body: { ...paymentStarted.body, isDeposit: true, amountCents: 80_000, depositStrategy: "CHARGE_REFUND", depositHoldDays: 30 } })
    expect(await startPartnerCheckoutPayment(caller, "tx_1")).toMatchObject({ deposit: { method: "charge", days: 30 } })
  })

  it("is refused before the earlier steps, and once nothing is left to pay", async () => {
    findTransaction.mockResolvedValue(transaction({ stepSwitches: { contract: true, payment: true }, contractTemplateId: "tpl_1", contractTemplate: { id: "tpl_1", content: "<p>Contrat</p>" } }))
    expect(await code(startPartnerCheckoutPayment(caller, "tx_1"))).toBe("step_not_available")

    findTransaction.mockResolvedValue(cardOnly())
    expect(await code(startPartnerCheckoutPayment(caller, "tx_1"))).toBe("step_not_available")
    expect(startPayment).not.toHaveBeenCalled()
  })

  it("asks the consent before a rental payment that saves the card, and names a vendor not ready for payments", async () => {
    startPayment.mockResolvedValue({ status: 409, body: { success: false, code: "consent_required", message: "Please accept the card terms first." } })
    expect(await code(startPartnerCheckoutPayment(caller, "tx_1"))).toBe("consent_required")

    startPayment.mockResolvedValue({ status: 422, body: { success: false, message: "Payment configuration unavailable" } })
    expect(await code(startPartnerCheckoutPayment(caller, "tx_1"))).toBe("stripe_not_connected")
  })

  it("is closed for a cancelled booking", async () => {
    linkContext.mockResolvedValue({ state: "cancelled" })
    expect(await code(startPartnerCheckoutPayment(caller, "tx_1"))).toBe("checkout_closed")
  })

  it("confirms the PaymentIntent and answers the checkout state", async () => {
    findTransaction.mockResolvedValueOnce(transaction()).mockResolvedValueOnce(transaction({ payments: [] }))
    const checkout = await confirmPartnerCheckoutPayment(caller, "tx_1", { paymentIntentId: "pi_1" })
    expect(confirmPayment).toHaveBeenCalledWith("link_1", "pi_1")
    expect(checkout).toMatchObject({ bookingId: "tx_1", status: "open" })
  })

  it("turns a refused card, another booking's intent and an unknown intent into partner errors", async () => {
    confirmPayment.mockResolvedValue({ status: 422, body: { success: false, message: "Your card was declined." } })
    const refused = await confirmPartnerCheckoutPayment(caller, "tx_1", { paymentIntentId: "pi_1" }).catch((error) => error)
    expect(refused).toMatchObject({ code: "payment_failed", message: "Your card was declined.", status: 402 })

    confirmPayment.mockResolvedValue({ status: 403, body: { success: false, message: "Payment intent mismatch" } })
    expect(await code(confirmPartnerCheckoutPayment(caller, "tx_1", { paymentIntentId: "pi_other" }))).toBe("invalid_request")

    confirmPayment.mockRejectedValue(Object.assign(new Error("No such payment_intent: 'pi_x'"), { code: "resource_missing" }))
    expect(await code(confirmPartnerCheckoutPayment(caller, "tx_1", { paymentIntentId: "pi_x" }))).toBe("invalid_request")
  })
})

describe("card consent", () => {
  it("keeps the partner's exact words, their hash and the customer's evidence", async () => {
    await recordPartnerCheckoutCardConsent(caller, "tx_1", CONSENT, EVIDENCE)
    const hash = createHash("sha256").update(`${CONSENT.consentVersion}\n${CONSENT.textFr}\n${CONSENT.textEn}`, "utf8").digest("hex")
    expect(recordConsent).toHaveBeenCalledWith(expect.anything(), {
      transaction: { id: "tx_1", externalRef: "LZ-2026-000200", locale: "fr", vendor: VENDOR },
      ip: EVIDENCE.ip,
      userAgent: EVIDENCE.userAgent,
      text: { version: "card-90d-v3", fr: CONSENT.textFr, en: CONSENT.textEn, hash, legalReviewPending: false },
    })
  })

  it("changes nothing once the consent is recorded or the card is saved", async () => {
    findConsent.mockResolvedValue({ id: "consent_0" })
    await recordPartnerCheckoutCardConsent(caller, "tx_1", CONSENT, EVIDENCE)

    findConsent.mockResolvedValue(null)
    findTransaction.mockResolvedValue(transaction({ cardSecurity: { status: "SECURED" } }))
    await recordPartnerCheckoutCardConsent(caller, "tx_1", CONSENT, EVIDENCE)
    expect(recordConsent).not.toHaveBeenCalled()
  })

  it("is refused for a booking that keeps no card", async () => {
    findTransaction.mockResolvedValue(transaction({ stepSwitches: { payment: true, cardSecurity: false } }))
    expect(await code(recordPartnerCheckoutCardConsent(caller, "tx_1", CONSENT, EVIDENCE))).toBe("step_not_available")
  })
})

describe("card saved on its own", () => {
  it("starts the SetupIntent only when the checkout is on the card step", async () => {
    expect(await code(startPartnerCheckoutCard(caller, "tx_1"))).toBe("step_not_available")

    findTransaction.mockResolvedValue(cardOnly())
    expect(await startPartnerCheckoutCard(caller, "tx_1")).toEqual({ clientSecret: "seti_1_secret_x", stripeAccountId: "acct_vendor", publishableKey: "pk_test_platform" })
    expect(cardContext).toHaveBeenCalledWith("tok_1")
  })

  it("asks the consent first, and turns Contrazy's card refusals into partner errors", async () => {
    findTransaction.mockResolvedValue(cardOnly())
    startCard.mockResolvedValue({ status: 409, body: { success: false, code: "consent_required", message: "Please accept the card terms first." } })
    expect(await code(startPartnerCheckoutCard(caller, "tx_1"))).toBe("consent_required")

    cardContext.mockResolvedValue({ error: { status: 422 } })
    expect(await code(startPartnerCheckoutCard(caller, "tx_1"))).toBe("stripe_not_connected")
  })

  it("confirms the SetupIntent; a refused card, another booking's intent or a missing consent are partner errors", async () => {
    findTransaction.mockResolvedValue(cardOnly())
    expect(await confirmPartnerCheckoutCard(caller, "tx_1", { setupIntentId: "seti_1" })).toMatchObject({ bookingId: "tx_1" })
    expect(confirmCard).toHaveBeenCalledWith(expect.objectContaining({ stripeAccountId: "acct_vendor" }), "seti_1")

    confirmCard.mockResolvedValue({ status: 422, body: { success: false, message: "Your card does not support this type of purchase." } })
    expect(await code(confirmPartnerCheckoutCard(caller, "tx_1", { setupIntentId: "seti_1" }))).toBe("payment_failed")
    confirmCard.mockResolvedValue({ status: 403, body: { success: false, message: "Setup intent mismatch" } })
    expect(await code(confirmPartnerCheckoutCard(caller, "tx_1", { setupIntentId: "seti_9" }))).toBe("invalid_request")
    confirmCard.mockResolvedValue({ status: 409, body: { success: false, code: "consent_required", message: "No consent is recorded for this transaction." } })
    expect(await code(confirmPartnerCheckoutCard(caller, "tx_1", { setupIntentId: "seti_1" }))).toBe("consent_required")
  })

  it("keeps an unexpected card-security failure of the payment as a client error", async () => {
    startPayment.mockRejectedValue(new CardSecurityError("customer_email_missing", "The customer's e-mail is needed to save a card."))
    expect(await code(startPartnerCheckoutPayment(caller, "tx_1"))).toBe("invalid_request")
  })
})
