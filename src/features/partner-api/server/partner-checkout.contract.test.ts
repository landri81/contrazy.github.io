import { beforeEach, describe, expect, it, vi } from "vitest"

/** Embedded checkout, contract and signature (M10, C6): the version read is the one accepted; signing comes after. */

const findTransaction = vi.fn()
const linkContext = vi.fn()
const review = vi.fn()
const sign = vi.fn()
const contractHtml = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: { JWT_ENCRYPTION_SECRET: "s".repeat(40) } }))
vi.mock("@/lib/integrations/resend", () => ({}))
vi.mock("@/lib/integrations/stripe", () => ({ getStripePublishableKey: () => "pk_test_platform" }))
vi.mock("@/lib/integrations/cloudinary", () => ({ cloudinary: {} }))
vi.mock("@/lib/db/prisma", () => ({ prisma: { transaction: { findUnique: (...a: unknown[]) => findTransaction(...a) } } }))
vi.mock("@/features/partner-api/server/partner-bookings", () => ({ requirePartnerBooking: async (_vendorId: string, where: { id: string }) => ({ id: where.id }), assertReturnUrlAllowed: () => undefined }))
vi.mock("@/features/transactions/server/transaction-links", () => ({ getClientLinkAccessContext: (...a: unknown[]) => linkContext(...a) }))
vi.mock("@/features/client-flow/server/steps/review-contract", () => ({ reviewClientContract: (...a: unknown[]) => review(...a) }))
vi.mock("@/features/client-flow/server/steps/sign-contract", () => ({ signClientContract: (...a: unknown[]) => sign(...a) }))
vi.mock("@/features/client-flow/server/client-flow-data", async () => ({
  ...(await vi.importActual<object>("@/features/client-flow/server/client-flow-data")),
  buildPopulatedContractContent: () => contractHtml(),
}))

const { acceptPartnerCheckoutContract, getPartnerCheckoutContract, signPartnerCheckout } = await import("./partner-checkout")
const { PartnerApiError } = await import("@/lib/partner-api/errors")

const caller = { vendorProfile: { id: "vendor_locaz", partnerAllowedOrigins: ["https://www.locaz.co"] } }
const code = async (run: Promise<unknown>) => run.then(() => "accepted", (error) => (error instanceof PartnerApiError ? error.code : String(error)))
const PNG = "data:image/png;base64,iVBORw0KGgo="

function transaction(patch: Record<string, unknown> = {}) {
  return {
    id: "tx_1",
    status: "LINK_SENT",
    locale: "fr",
    currency: "EUR",
    amount: 15_700,
    depositAmount: 0,
    requiresKyc: false,
    requireSelfie: false,
    requireClientCompany: false,
    stepSwitches: { contract: true, payment: true },
    flowType: "STANDARD",
    clientProfileId: null,
    clientProfile: null,
    link: { token: "tok_1", status: "ACTIVE", expiresAt: null },
    requirements: [],
    documents: [],
    customFields: [],
    kycVerification: null,
    contractTemplateId: "tpl_1",
    contractTemplate: { id: "tpl_1", content: "<p>Contrat</p>" },
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

beforeEach(() => {
  vi.clearAllMocks()
  contractHtml.mockReturnValue("<h1>Contrat de location</h1><p>Lina Martin</p>")
  findTransaction.mockResolvedValue(transaction())
  linkContext.mockResolvedValue({ state: "active", link: { id: "link_1", token: "tok_1", transaction: { id: "tx_1" } } })
  review.mockResolvedValue({ status: 200, body: { success: true, nextStep: "sign" } })
  sign.mockResolvedValue({ status: 200, body: { success: true, nextStep: "payment" } })
})

describe("contract", () => {
  it("shows the populated agreement with a version that changes with its text", async () => {
    const first = await getPartnerCheckoutContract(caller, "tx_1")
    expect(first).toMatchObject({ html: "<h1>Contrat de location</h1><p>Lina Martin</p>", locale: "fr" })
    expect(first.version).toMatch(/^v_[0-9a-f]{32}$/)
    contractHtml.mockReturnValue("<h1>Contrat de location</h1><p>Lina Martin</p><p>Changed</p>")
    expect((await getPartnerCheckoutContract(caller, "tx_1")).version).not.toBe(first.version)
  })

  it("accepts the version the customer read, through the contract step of Contrazy's pages; refuses a changed one", async () => {
    const { version } = await getPartnerCheckoutContract(caller, "tx_1")
    expect((await acceptPartnerCheckoutContract(caller, "tx_1", { version })).bookingId).toBe("tx_1")
    expect(review).toHaveBeenCalledWith(expect.objectContaining({ id: "link_1" }))

    contractHtml.mockReturnValue("<h1>Contrat de location</h1><p>New clause</p>")
    expect(await code(acceptPartnerCheckoutContract(caller, "tx_1", { version }))).toBe("version_mismatch")
    expect(review).toHaveBeenCalledTimes(1)
  })

  it("has no contract step when the booking has no template", async () => {
    findTransaction.mockResolvedValue(transaction({ contractTemplateId: null, contractTemplate: null }))
    expect(await code(getPartnerCheckoutContract(caller, "tx_1"))).toBe("step_not_available")
  })
})

describe("signature", () => {
  const input = { method: "type" as const, image: PNG, typedName: "Lina Martin", font: "caveat", city: "Nice", timezone: "Europe/Paris" }

  it("signs an accepted contract through the signature step of Contrazy's pages, with the customer's IP", async () => {
    findTransaction.mockResolvedValue(transaction({ contractArtifact: { reviewCompletedAt: new Date(), signedPdfUrl: null } }))
    await signPartnerCheckout(caller, "tx_1", input, "203.0.113.9")
    expect(sign).toHaveBeenCalledWith("link_1", { signatureDataUrl: PNG, signedTimezone: "Europe/Paris", signatureMethod: "type", typedValue: "Lina Martin", fontKey: "caveat", signatureCity: "Nice" }, "203.0.113.9")
  })

  it("refuses to sign before the contract is accepted, and passes on the step's refusals", async () => {
    expect(await code(signPartnerCheckout(caller, "tx_1", input, null))).toBe("step_not_available")
    expect(sign).not.toHaveBeenCalled()

    findTransaction.mockResolvedValue(transaction({ contractArtifact: { reviewCompletedAt: new Date(), signedPdfUrl: null } }))
    sign.mockResolvedValueOnce({ status: 409, body: { success: false, message: "The signature can no longer be changed after payment has started." } })
    expect(await code(signPartnerCheckout(caller, "tx_1", input, null))).toBe("step_not_available")
  })
})
