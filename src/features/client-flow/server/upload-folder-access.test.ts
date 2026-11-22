import { beforeEach, describe, expect, it, vi } from "vitest"

/** Security review, 22 Nov 2026: upload signatures only for a folder the caller may write to. */

const linkContext = vi.fn()
const getAuthSession = vi.fn()
const findTransaction = vi.fn()

vi.mock("@/features/transactions/server/transaction-links", () => ({ getClientLinkAccessContext: (...a: unknown[]) => linkContext(...a) }))
vi.mock("@/lib/auth/session", () => ({ getAuthSession: () => getAuthSession() }))
vi.mock("@/lib/db/prisma", () => ({ prisma: { transaction: { findFirst: (...a: unknown[]) => findTransaction(...a) } } }))

const { parseUploadFolder, resolveUploadFolderAccess } = await import("./upload-folder-access")

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90"

beforeEach(() => {
  linkContext.mockReset()
  getAuthSession.mockReset()
  findTransaction.mockReset()
})

describe("parseUploadFolder", () => {
  it("knows the customer folders of a secure link and a dispute's folder", () => {
    expect(parseUploadFolder(`conntrazy/client-documents/${TOKEN}`)).toEqual({ kind: "client", token: TOKEN })
    expect(parseUploadFolder(`conntrazy/client-kyc/${TOKEN}`)).toEqual({ kind: "client", token: TOKEN })
    expect(parseUploadFolder(`conntrazy/report-assets/${TOKEN}/check_in`)).toEqual({ kind: "client", token: TOKEN })
    expect(parseUploadFolder("conntrazy/disputes/cmabc123def456ghi789jkl0")).toEqual({ kind: "dispute", transactionId: "cmabc123def456ghi789jkl0" })
  })

  it("refuses any other folder, the default one and tricks with paths", () => {
    for (const folder of ["", "conntrazy", "conntrazy/contracts", "anything/else", `conntrazy/client-documents/${TOKEN}/../contracts`, `conntrazy/client-documents/${TOKEN}/x`, "conntrazy/client-documents/short", `conntrazy/report-assets/${TOKEN}`, `conntrazy/report-assets/${TOKEN}/Check In`]) {
      expect(parseUploadFolder(folder)).toBeNull()
    }
  })
})

describe("resolveUploadFolderAccess", () => {
  it("allows a customer folder only while its secure link is live", async () => {
    linkContext.mockResolvedValue({ state: "active" })
    expect(await resolveUploadFolderAccess(`conntrazy/client-documents/${TOKEN}`)).toEqual({ allowed: true })
    expect(linkContext).toHaveBeenCalledWith(TOKEN)
    linkContext.mockResolvedValue({ state: "cancelled" })
    expect(await resolveUploadFolderAccess(`conntrazy/client-kyc/${TOKEN}`)).toEqual({ allowed: false, status: 403 })
    linkContext.mockResolvedValue({ state: "missing" })
    expect(await resolveUploadFolderAccess(`conntrazy/report-assets/${TOKEN}/check_out`)).toEqual({ allowed: false, status: 403 })
  })

  it("allows a dispute folder to the vendor owning the transaction, or an admin; nobody signed out", async () => {
    const folder = "conntrazy/disputes/cmabc123def456ghi789jkl0"
    getAuthSession.mockResolvedValue(null)
    expect(await resolveUploadFolderAccess(folder)).toEqual({ allowed: false, status: 401 })

    getAuthSession.mockResolvedValue({ user: { id: "user_vendor", role: "VENDOR" } })
    findTransaction.mockResolvedValue(null)
    expect(await resolveUploadFolderAccess(folder)).toEqual({ allowed: false, status: 403 })
    expect(findTransaction.mock.calls[0][0].where).toEqual({ id: "cmabc123def456ghi789jkl0", vendor: { userId: "user_vendor" } })
    findTransaction.mockResolvedValue({ id: "cmabc123def456ghi789jkl0" })
    expect(await resolveUploadFolderAccess(folder)).toEqual({ allowed: true })

    getAuthSession.mockResolvedValue({ user: { id: "user_admin", role: "SUPER_ADMIN" } })
    expect(await resolveUploadFolderAccess(folder)).toEqual({ allowed: true })
  })

  it("refuses an unknown folder before looking anything up", async () => {
    expect(await resolveUploadFolderAccess("conntrazy")).toEqual({ allowed: false, status: 400 })
    expect(linkContext).not.toHaveBeenCalled()
    expect(getAuthSession).not.toHaveBeenCalled()
  })
})
