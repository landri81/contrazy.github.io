import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The completion e-mails go once per transaction: the customer's confirmation and Stripe's webhook both complete the
 * same payment, and only the call that changes the status sends them (found on LOCAZ's live check, 5 Nov 2026: the
 * customer and the vendor got each e-mail twice). Prisma and Resend mocked.
 */

const sendCustomer = vi.fn(async () => true)
const sendVendor = vi.fn(async () => true)
vi.mock("@/lib/integrations/resend", () => ({
  sendTransactionCompletedEmail: (...a: unknown[]) => sendCustomer(...(a as [])),
  sendVendorTransactionCompletedEmail: (...a: unknown[]) => sendVendor(...(a as [])),
  sendCustomerDepositStatusEmail: vi.fn(),
  sendVendorDepositAlert: vi.fn(),
  sendVendorDepositStatusEmail: vi.fn(),
}))
vi.mock("@/features/transactions/server/transaction-events", () => ({ recordTransactionEvent: vi.fn(async () => undefined) }))
vi.mock("@/features/transactions/server/transaction-links", () => ({ markTransactionLinkCompleted: vi.fn(async () => undefined) }))
vi.mock("@/lib/site-url", () => ({ getSiteUrl: () => "https://www.contrazy.com" }))

const { completeTransactionWithoutPayment } = await import("./transaction-finance")

const TRANSACTION = {
  id: "tx_1",
  reference: "TX-1",
  externalRef: "LZ-2026-000300",
  status: "IN_PROGRESS",
  amount: 0,
  depositAmount: 0,
  paymentCollectionTiming: null,
  stepSwitches: null,
  customerCompletedAt: null,
  locale: "fr",
  link: null,
  payments: [],
  depositAuthorization: null,
  contractArtifact: null,
  cardSecurity: null,
  clientProfile: { email: "noe@locaz.test", fullName: "Noé Martin" },
  vendor: { businessName: "LOCAZ", businessEmail: "vendor@locaz.test", supportEmail: null, businessPhone: null },
}

const updateMany = vi.fn()
const db = {
  transaction: { findUnique: vi.fn(async () => TRANSACTION), update: vi.fn(), updateMany: (...a: unknown[]) => updateMany(...a) },
  documentAsset: { findMany: vi.fn(async () => []) },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("completion e-mails", () => {
  it("are sent by the call that completes the transaction, never by a second one for the same payment", async () => {
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })
    await completeTransactionWithoutPayment(db as never, "tx_1")
    await completeTransactionWithoutPayment(db as never, "tx_1")
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "tx_1", status: { not: "COMPLETED" } }, data: { status: "COMPLETED" } })
    expect(sendCustomer).toHaveBeenCalledTimes(1)
    expect(sendVendor).toHaveBeenCalledTimes(1)
  })
})
