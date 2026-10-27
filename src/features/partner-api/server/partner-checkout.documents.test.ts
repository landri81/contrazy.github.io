import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Embedded checkout, documents step (M10, C4): a file stored per slot with a signed fileId, then every file submitted
 * through the same documents step as Contrazy's page; closed, locked or foreign requests refused.
 */

const findTransaction = vi.fn()
const linkContext = vi.fn()
const submitDocuments = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/env", () => ({ env: { JWT_ENCRYPTION_SECRET: "s".repeat(40) } }))
vi.mock("@/lib/integrations/resend", () => ({}))
vi.mock("@/lib/integrations/stripe", () => ({}))
vi.mock("@/lib/integrations/cloudinary", () => ({ cloudinary: {} }))
vi.mock("@/lib/db/prisma", () => ({ prisma: { transaction: { findUnique: (...a: unknown[]) => findTransaction(...a) } } }))
vi.mock("@/features/partner-api/server/partner-bookings", () => ({ requirePartnerBooking: async (_vendorId: string, where: { id: string }) => ({ id: where.id }) }))
vi.mock("@/features/transactions/server/transaction-links", () => ({ getClientLinkAccessContext: (...a: unknown[]) => linkContext(...a) }))
vi.mock("@/features/client-flow/server/steps/submit-documents", () => ({ submitClientDocuments: (...a: unknown[]) => submitDocuments(...a) }))

const { uploadPartnerCheckoutFile, submitPartnerCheckoutDocuments } = await import("./partner-checkout")
const { PartnerApiError } = await import("@/lib/partner-api/errors")

const SECRET = "s".repeat(40)
const caller = { vendorProfile: { id: "vendor_locaz" } }
const licence = { id: "req_licence", label: "Permis de conduire", instructions: null, type: "DOCUMENT", category: "DRIVER_LICENSE", requiredFileCount: 2, fileSlotLabels: ["Recto", "Verso"], required: true }
const notes = { id: "req_notes", label: "Remarque", instructions: null, type: "TEXT", category: "CUSTOM", requiredFileCount: 1, fileSlotLabels: null, required: false }

function transaction(patch: Record<string, unknown> = {}) {
  return {
    id: "tx_1",
    status: "LINK_SENT",
    currency: "EUR",
    amount: 15_700,
    depositAmount: 0,
    requiresKyc: false,
    requireSelfie: false,
    requireClientCompany: false,
    stepSwitches: { documents: true, payment: true },
    flowType: "STANDARD",
    clientProfileId: null,
    clientProfile: null,
    link: { token: "tok_1", status: "ACTIVE", expiresAt: null },
    requirements: [licence, notes],
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

const upload = vi.fn(async () => ({ publicId: "client-documents/tok_1/abc", secureUrl: "https://res.cloudinary.com/demo/abc.jpg" }))
const deps = { secret: SECRET, upload }

function form(fields: Record<string, string>, file: File | null = new File(["image"], "recto.jpg", { type: "image/jpeg" })) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  if (file) data.set("file", file)
  return data
}

const code = async (run: Promise<unknown>) => run.then(() => "accepted", (error) => (error instanceof PartnerApiError ? error.code : String(error)))

beforeEach(() => {
  vi.clearAllMocks()
  findTransaction.mockResolvedValue(transaction())
  linkContext.mockResolvedValue({ state: "active", link: { id: "link_1", token: "tok_1", transaction: { id: "tx_1", clientProfileId: null } } })
  submitDocuments.mockResolvedValue({ status: 200, body: { success: true, nextStep: "payment" } })
})

describe("uploadPartnerCheckoutFile", () => {
  it("stores the file in the booking's folder and answers a signed fileId for that slot", async () => {
    const stored = await uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "1" }), deps)
    expect(stored).toMatchObject({ requirementId: "req_licence", slotIndex: 1, fileName: "recto.jpg" })
    expect(stored.fileId).toMatch(/^cf_/)
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ fileName: "recto.jpg", pdf: false }), "tok_1")
  })

  it("checks the file and the slot before storing anything", async () => {
    expect(await code(uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "0" }, new File(["x"], "a.exe", { type: "application/x-msdownload" })), deps))).toBe("invalid_file")
    expect(await code(uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "0" }, new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" })), deps))).toBe("invalid_file")
    expect(await code(uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "0" }, null), deps))).toBe("invalid_file")
    expect(await code(uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "2" }), deps))).toBe("invalid_request")
    expect(await code(uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_notes", slotIndex: "0" }), deps))).toBe("invalid_request")
    expect(await code(uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_other", slotIndex: "0" }), deps))).toBe("invalid_request")
    expect(upload).not.toHaveBeenCalled()
  })

  it("refuses a closed checkout and documents once the payment started", async () => {
    linkContext.mockResolvedValueOnce({ state: "cancelled", link: {} })
    expect(await code(uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "0" }), deps))).toBe("checkout_closed")
    findTransaction.mockResolvedValueOnce(transaction({ payments: [{ kind: "SERVICE_PAYMENT", status: "SUCCEEDED" }] }))
    expect(await code(uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "0" }), deps))).toBe("step_not_available")
  })
})

describe("submitPartnerCheckoutDocuments", () => {
  it("hands the stored files to the documents step of Contrazy's pages and answers the checkout state", async () => {
    const recto = await uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "0" }), deps)
    const verso = await uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "1" }), deps)
    const checkout = await submitPartnerCheckoutDocuments(caller, "tx_1", { files: [recto, verso].map(({ fileId, requirementId, slotIndex }) => ({ fileId, requirementId, slotIndex })) }, SECRET)

    expect(checkout.bookingId).toBe("tx_1")
    const [link, documents] = submitDocuments.mock.calls[0]
    expect(link).toMatchObject({ token: "tok_1" })
    expect(documents).toEqual([
      { requirementId: "req_licence", type: "DOCUMENT", slotIndex: 0, source: "UPLOAD", secure_url: "https://res.cloudinary.com/demo/abc.jpg", public_id: "client-documents/tok_1/abc", original_filename: "recto.jpg" },
      { requirementId: "req_licence", type: "DOCUMENT", slotIndex: 1, source: "UPLOAD", secure_url: "https://res.cloudinary.com/demo/abc.jpg", public_id: "client-documents/tok_1/abc", original_filename: "recto.jpg" },
    ])
  })

  it("refuses a fileId of another slot or booking, and passes on the step's own refusals", async () => {
    const recto = await uploadPartnerCheckoutFile(caller, "tx_1", form({ requirementId: "req_licence", slotIndex: "0" }), deps)
    expect(await code(submitPartnerCheckoutDocuments(caller, "tx_1", { files: [{ fileId: recto.fileId, requirementId: "req_licence", slotIndex: 1 }] }, SECRET))).toBe("invalid_request")
    expect(await code(submitPartnerCheckoutDocuments(caller, "tx_1", { files: [{ fileId: "cf_forged.signature", requirementId: "req_licence", slotIndex: 0 }] }, SECRET))).toBe("invalid_request")
    expect(submitDocuments).not.toHaveBeenCalled()

    submitDocuments.mockResolvedValueOnce({ status: 400, body: { success: false, message: "Upload every required file before continuing." } })
    expect(await code(submitPartnerCheckoutDocuments(caller, "tx_1", { files: [{ fileId: recto.fileId, requirementId: "req_licence", slotIndex: 0 }] }, SECRET))).toBe("invalid_request")
  })
})
