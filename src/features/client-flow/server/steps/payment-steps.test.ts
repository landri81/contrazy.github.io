import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The payment step, shared by Contrazy's page and the partner API (M10): the PaymentIntent of the next money stage on
 * the vendor's connected account, and its confirmation read at Stripe. Same answers as the routes gave before.
 */

const findLink = vi.fn()
const createIntent = vi.fn()
const retrieveIntent = vi.fn()
const nextStage = vi.fn()
const findConsent = vi.fn()
const ensureCustomer = vi.fn()
const trackPending = vi.fn()
const recordEvent = vi.fn()
const upsertService = vi.fn()
const upsertDepositCharge = vi.fn()
const upsertDepositAuthorization = vi.fn()
const syncFinance = vi.fn()
const securePaidCard = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/db/prisma", () => ({ prisma: { transactionLink: { findUnique: (...a: unknown[]) => findLink(...a) } } }))
vi.mock("@/lib/integrations/stripe", () => ({
  stripe: { paymentIntents: { create: (...a: unknown[]) => createIntent(...a), retrieve: (...a: unknown[]) => retrieveIntent(...a) } },
  stripeGateway: {},
  getConnectedAccountRequestOptions: (stripeAccount: string) => ({ stripeAccount }),
  getStripePublishableKey: () => "pk_test_platform",
}))
vi.mock("@/lib/integrations/resend", () => ({ sendVendorFeeReceiptEmail: vi.fn(async () => undefined) }))
vi.mock("@/features/transactions/server/transaction-links", () => ({ markTransactionLinkOpened: vi.fn(async () => undefined) }))
vi.mock("@/features/transactions/server/transaction-events", () => ({ recordTransactionEvent: (...a: unknown[]) => recordEvent(...a) }))
vi.mock("@/features/transactions/server/transaction-finance", () => ({
  getNextFinanceStage: (...a: unknown[]) => nextStage(...a),
  syncTransactionFinanceState: (...a: unknown[]) => syncFinance(...a),
  upsertServicePaymentFromIntent: (...a: unknown[]) => upsertService(...a),
  upsertDepositChargeFromIntent: (...a: unknown[]) => upsertDepositCharge(...a),
  upsertDepositAuthorizationFromIntent: (...a: unknown[]) => upsertDepositAuthorization(...a),
}))
vi.mock("@/features/card-security/server/card-security", () => ({
  findCardConsent: (...a: unknown[]) => findConsent(...a),
  ensurePartnerCustomer: (...a: unknown[]) => ensureCustomer(...a),
  trackPendingCardSecurity: (...a: unknown[]) => trackPending(...a),
}))
vi.mock("@/features/card-security/server/secure-paid-card", () => ({ securePaidCardIfRequested: (...a: unknown[]) => securePaidCard(...a) }))
vi.mock("@/features/subscriptions/server/feature-gates", () => ({ hasActiveSubscription: () => false }))

const { startClientPayment } = await import("./start-payment")
const { confirmClientPayment } = await import("./confirm-payment")

const activeLink = { link: { id: "link_1", transaction: { id: "tx_1" } } } as never

function linkRow(patch: Record<string, unknown> = {}) {
  return {
    id: "link_1",
    transaction: {
      id: "tx_1",
      vendorId: "vendor_1",
      kind: "RENTAL",
      title: "Location Peugeot 208",
      reference: "CZ-0001",
      locale: "fr",
      currency: "EUR",
      amount: 15_700,
      depositAmount: 80_000,
      depositHoldDays: 7,
      stepSwitches: { payment: true, hold: true, cardSecurity: true },
      vendor: { stripeAccountId: "acct_vendor", subscription: null, businessEmail: null },
      clientProfile: { email: "alice.martin@locaz.test", fullName: "Alice Martin", phone: null },
      payments: [],
      depositAuthorization: null,
      cardSecurity: null,
      contractArtifact: null,
      ...patch,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  findLink.mockResolvedValue(linkRow())
  createIntent.mockImplementation(async (params: { amount: number }) => ({ id: "pi_1", client_secret: "pi_1_secret_x", amount: params.amount }))
  findConsent.mockResolvedValue({ id: "consent_1" })
  ensureCustomer.mockResolvedValue({ id: "pcus_1", stripeCustomerId: "cus_1" })
  syncFinance.mockResolvedValue({ id: "tx_1" })
})

describe("startClientPayment", () => {
  it("holds the deposit first: manual capture on the vendor's connected account", async () => {
    nextStage.mockReturnValue("deposit_authorization")
    const result = await startClientPayment(activeLink, "tok_1")

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ success: true, clientSecret: "pi_1_secret_x", stripeAccountId: "acct_vendor", publishableKey: "pk_test_platform", amountCents: 80_000, isDeposit: true, depositStrategy: "AUTHORIZATION_HOLD", depositHoldDays: 7, savesCard: false })
    const [params, options] = createIntent.mock.calls[0]
    expect(params).toMatchObject({ amount: 80_000, currency: "eur", capture_method: "manual", metadata: { transactionId: "tx_1", financeStage: "deposit_authorization", token: "tok_1" } })
    expect(params).not.toHaveProperty("setup_future_usage")
    expect(options).toEqual({ stripeAccount: "acct_vendor" })
  })

  it("saves the card with the rental payment when the booking keeps it, after consent only", async () => {
    nextStage.mockReturnValue("service_payment")
    const result = await startClientPayment(activeLink, "tok_1")
    expect(result.body).toMatchObject({ amountCents: 15_700, isDeposit: false, savesCard: true })
    expect(createIntent.mock.calls[0][0]).toMatchObject({ capture_method: "automatic", customer: "cus_1", setup_future_usage: "off_session", metadata: { cardSecurity: "true" } })
    expect(trackPending).toHaveBeenCalledWith(expect.anything(), { transactionId: "tx_1", partnerCustomer: { id: "pcus_1", stripeCustomerId: "cus_1" }, paymentIntentId: "pi_1" })

    createIntent.mockClear()
    findConsent.mockResolvedValue(null)
    expect(await startClientPayment(activeLink, "tok_1")).toEqual({ status: 409, body: { success: false, code: "consent_required", message: "Please accept the card terms first." } })
    expect(createIntent).not.toHaveBeenCalled()
  })

  it("sends the customer on when nothing is to be paid, and refuses a vendor without a connected account", async () => {
    nextStage.mockReturnValue("complete")
    expect((await startClientPayment(activeLink, "tok_1")).body).toEqual({ success: true, redirect: "/fr/t/tok_1/complete" })
    nextStage.mockReturnValue("card_security")
    expect((await startClientPayment(activeLink, "tok_1")).body).toEqual({ success: true, redirect: "/fr/t/tok_1/payment?stage=card" })

    findLink.mockResolvedValue(linkRow({ vendor: { stripeAccountId: null, subscription: null } }))
    expect(await startClientPayment(activeLink, "tok_1")).toEqual({ status: 422, body: { success: false, message: "Payment configuration unavailable" } })
  })
})

describe("confirmClientPayment", () => {
  const intent = (patch: Record<string, unknown>) => ({ id: "pi_1", amount: 15_700, currency: "eur", metadata: { transactionId: "tx_1", financeStage: "service_payment" }, ...patch })

  it("records the rental payment and the card it saved, then answers the next step", async () => {
    retrieveIntent.mockResolvedValue(intent({ status: "succeeded" }))
    nextStage.mockReturnValue("complete")
    expect(await confirmClientPayment("link_1", "pi_1")).toEqual({ status: 200, body: { success: true, status: "confirmed", nextStep: "complete" } })
    expect(retrieveIntent).toHaveBeenCalledWith("pi_1", {}, { stripeAccount: "acct_vendor" })
    expect(upsertService).toHaveBeenCalled()
    expect(securePaidCard).toHaveBeenCalledWith("tx_1", "acct_vendor", expect.objectContaining({ id: "pi_1" }))
  })

  it("records a held deposit, and keeps the payment step open after it", async () => {
    retrieveIntent.mockResolvedValue(intent({ status: "requires_capture", metadata: { transactionId: "tx_1", financeStage: "deposit_authorization" } }))
    nextStage.mockReturnValue("service_payment")
    expect((await confirmClientPayment("link_1", "pi_1")).body).toEqual({ success: true, status: "confirmed", nextStep: "payment" })
    expect(upsertDepositAuthorization).toHaveBeenCalled()
    expect(upsertService).not.toHaveBeenCalled()
  })

  it("refuses another booking's intent, reports a refused card and waits on a processing one", async () => {
    retrieveIntent.mockResolvedValue(intent({ status: "succeeded", metadata: { transactionId: "tx_other" } }))
    expect(await confirmClientPayment("link_1", "pi_1")).toEqual({ status: 403, body: { success: false, message: "Payment intent mismatch" } })

    retrieveIntent.mockResolvedValue(intent({ status: "requires_payment_method", last_payment_error: { message: "Your card was declined." } }))
    expect(await confirmClientPayment("link_1", "pi_1")).toEqual({ status: 422, body: { success: false, message: "Your card was declined." } })

    retrieveIntent.mockResolvedValue(intent({ status: "processing" }))
    expect(await confirmClientPayment("link_1", "pi_1")).toEqual({ status: 200, body: { success: true, status: "processing", nextStep: "payment" } })
    expect(syncFinance).not.toHaveBeenCalled()
  })
})
