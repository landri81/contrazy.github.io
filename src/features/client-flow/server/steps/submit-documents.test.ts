import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The documents step (M10), sent again after the vendor refused the documents (LOCAZ T21): accepted after payment, the
 * refusal cleared, the booking's status kept and never completed a second time.
 */

const findTransaction = vi.fn()
const findRequirements = vi.fn()
const findDocuments = vi.fn()
const upsertDocument = vi.fn()
const updateTransaction = vi.fn()
const recordEvent = vi.fn()
const complete = vi.fn()
const cleanup = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/integrations/resend", () => ({}))
vi.mock("@/lib/integrations/stripe", () => ({}))
vi.mock("@/lib/db/prisma", () => {
  const tx = {
    documentAsset: { upsert: (...a: unknown[]) => upsertDocument(...a), create: vi.fn(), deleteMany: vi.fn() },
    transaction: { update: (...a: unknown[]) => updateTransaction(...a) },
  }
  return {
    prisma: {
      transaction: { findUnique: (...a: unknown[]) => findTransaction(...a) },
      transactionRequirement: { findMany: (...a: unknown[]) => findRequirements(...a) },
      documentAsset: { findMany: (...a: unknown[]) => findDocuments(...a) },
      $transaction: (run: (client: typeof tx) => unknown) => run(tx),
    },
  }
})
vi.mock("@/features/transactions/server/transaction-links", () => ({ markTransactionLinkOpened: vi.fn(async () => undefined) }))
vi.mock("@/features/transactions/server/transaction-events", () => ({ recordTransactionEvent: (...a: unknown[]) => recordEvent(...a) }))
vi.mock("@/features/transactions/server/transaction-finance", () => ({
  completeTransactionWithoutPayment: (...a: unknown[]) => complete(...a),
  getNextFinanceStage: () => "complete",
}))
vi.mock("@/features/client-flow/server/client-document-assets", () => ({ destroyDocumentCloudinaryAssetIfUnreferenced: (...a: unknown[]) => cleanup(...a) }))

const { submitClientDocuments } = await import("./submit-documents")

const REJECTED_AT = new Date("2026-11-08T10:00:00Z")
const licence = { id: "req_licence", label: "Permis de conduire", instructions: null, type: "DOCUMENT", category: "DRIVER_LICENSE", requiredFileCount: 2, fileSlotLabels: ["Recto", "Verso"], required: true }
const oldFile = (slotIndex: number) => ({ id: `doc_${slotIndex}`, requirementId: "req_licence", label: "Permis de conduire", slotIndex, publicId: `old_${slotIndex}`, assetUrl: `https://res.cloudinary.com/x/old_${slotIndex}.jpg`, fileName: "old.jpg", uploadedAt: REJECTED_AT })

/** A LOCAZ booking already completed (paid, card saved), its licence refused by the vendor. */
function completedRefused(patch: Record<string, unknown> = {}) {
  return {
    id: "tx_1",
    status: "COMPLETED",
    currency: "EUR",
    amount: 15_700,
    depositAmount: 0,
    requiresKyc: false,
    requireSelfie: false,
    requireClientCompany: false,
    stepSwitches: { documents: true, payment: true },
    flowType: "STANDARD",
    checkOutRequestedAt: null,
    contractAtPickup: false,
    contractOpenedAt: null,
    clientProfileId: "cp_1",
    clientProfile: { firstName: "Lina", lastName: "Martin", email: "lina@locaz.test", address: "12 rue de France, 06000 Nice", country: "FR", birthCity: "Nice", birthDate: new Date("1988-05-20T00:00:00Z"), companyName: null },
    link: { id: "link_1", token: "tok_1", status: "COMPLETED", expiresAt: null },
    requirements: [licence],
    documents: [oldFile(0), oldFile(1)],
    customFields: [],
    kycVerification: null,
    contractTemplateId: null,
    contractTemplate: null,
    contractArtifact: null,
    signatureRecord: null,
    events: [{ type: "SERVICE_PAYMENT_SUCCEEDED" }],
    payments: [{ kind: "SERVICE_PAYMENT", status: "SUCCEEDED" }],
    depositAuthorization: null,
    cardSecurity: null,
    reportFields: [],
    reports: [],
    servicePaymentRequestedAt: new Date("2026-11-07T09:00:00Z"),
    documentsRejectedAt: REJECTED_AT,
    documentsRejectionReason: "Permis expiré.",
    ...patch,
  }
}

const link = { id: "link_1", token: "tok_1", transaction: { id: "tx_1", clientProfileId: "cp_1" } } as never
const newFiles = [0, 1].map((slotIndex) => ({ requirementId: "req_licence", slotIndex, source: "UPLOAD", secure_url: `https://res.cloudinary.com/x/new_${slotIndex}.jpg`, public_id: `new_${slotIndex}`, original_filename: "permis.jpg" }))

beforeEach(() => {
  vi.clearAllMocks()
  findRequirements.mockResolvedValue([licence])
  findDocuments.mockResolvedValue([oldFile(0), oldFile(1)])
})

describe("submitClientDocuments after a refusal (LOCAZ T21)", () => {
  it("takes the new documents once paid, clears the refusal, keeps the booking completed and completes nothing again", async () => {
    findTransaction.mockResolvedValueOnce(completedRefused()).mockResolvedValueOnce(completedRefused({ documentsRejectedAt: null, documentsRejectionReason: null }))
    const result = await submitClientDocuments(link, newFiles)
    expect(result).toMatchObject({ status: 200, body: { success: true } })
    expect(upsertDocument).toHaveBeenCalledTimes(2)
    expect(updateTransaction).toHaveBeenCalledWith({ where: { id: "tx_1" }, data: { documentsRejectedAt: null, documentsRejectionReason: null } })
    expect(recordEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "DOCUMENTS_SUBMITTED", title: "Client requirements submitted again", dedupeKey: `event:documents:tx_1:${REJECTED_AT.getTime()}` })
    )
    expect(complete).not.toHaveBeenCalled()
    // The refused files are replaced: their stored copies are cleaned up.
    expect(cleanup).toHaveBeenCalledTimes(2)
  })

  it("still refuses documents once paid when nothing was refused", async () => {
    findTransaction.mockResolvedValue(completedRefused({ documentsRejectedAt: null, documentsRejectionReason: null }))
    expect(await submitClientDocuments(link, newFiles)).toMatchObject({ status: 409 })
    expect(updateTransaction).not.toHaveBeenCalled()
  })
})
