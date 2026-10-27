import { beforeEach, describe, expect, it, vi } from "vitest"

/** One default contract template per vendor: the one partner bookings (LOCAZ) use when they name none. */

const findFirst = vi.fn()
const updateMany = vi.fn()
const update = vi.fn()
const auditCreate = vi.fn()

vi.mock("@/lib/db/prisma", () => {
  const tx = {
    contractTemplate: { findFirst: (...a: unknown[]) => findFirst(...a), updateMany: (...a: unknown[]) => updateMany(...a), update: (...a: unknown[]) => update(...a) },
    auditLog: { create: (...a: unknown[]) => auditCreate(...a) },
  }
  return { prisma: { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } }
})

const { setDefaultContractTemplate } = await import("./default-template")

beforeEach(() => {
  for (const mock of [findFirst, updateMany, update, auditCreate]) mock.mockReset()
  update.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, isDefault: true }))
})

describe("setDefaultContractTemplate", () => {
  it("marks the template and takes the mark off the vendor's other templates, with an audit row", async () => {
    findFirst.mockResolvedValue({ id: "tpl_2", name: "LOCAZ Daily LCD", isDefault: false })
    expect(await setDefaultContractTemplate("vendor_1", "tpl_2", "user_1")).toEqual({ id: "tpl_2", isDefault: true })

    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "tpl_2", vendorId: "vendor_1" })
    expect(updateMany.mock.calls[0][0]).toEqual({ where: { vendorId: "vendor_1", isDefault: true, NOT: { id: "tpl_2" } }, data: { isDefault: false } })
    expect(update.mock.calls[0][0]).toEqual({ where: { id: "tpl_2" }, data: { isDefault: true } })
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({ actorId: "user_1", action: "contract_template.set_default", entityId: "tpl_2" })
  })

  it("refuses another vendor's template and changes nothing", async () => {
    findFirst.mockResolvedValue(null)
    expect(await setDefaultContractTemplate("vendor_1", "tpl_other", "user_1")).toBeNull()
    expect(updateMany).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it("leaves a template that already is the default as it is", async () => {
    findFirst.mockResolvedValue({ id: "tpl_2", name: "LOCAZ Daily LCD", isDefault: true })
    expect(await setDefaultContractTemplate("vendor_1", "tpl_2", "user_1")).toMatchObject({ id: "tpl_2", isDefault: true })
    expect(update).not.toHaveBeenCalled()
    expect(auditCreate).not.toHaveBeenCalled()
  })
})
