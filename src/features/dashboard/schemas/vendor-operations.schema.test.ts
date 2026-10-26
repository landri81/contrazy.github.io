import { describe, expect, it } from "vitest"

import {
  getVendorTransactionParseErrorCode,
  SELFIE_REQUIRES_IDENTITY_MESSAGE,
  vendorBulkTransactionCreateSchema,
  vendorTransactionCreateSchema,
} from "@/features/dashboard/schemas/vendor-operations.schema"

const BASE_INPUT = { title: "Bike rental", serviceDate: "2026-11-02" }
const BULK_INPUT = { ...BASE_INPUT, recipientEmails: ["alice.martin@contrazy.test"] }

const schemas = [
  { name: "vendorTransactionCreateSchema", schema: vendorTransactionCreateSchema, input: BASE_INPUT },
  { name: "vendorBulkTransactionCreateSchema", schema: vendorBulkTransactionCreateSchema, input: BULK_INPUT },
] as const

describe.each(schemas)("$name selfie rule (C4)", ({ schema, input }) => {
  it("rejects requireSelfie without requiresKyc, on the requireSelfie path", () => {
    for (const requiresKyc of [false, undefined]) {
      const parsed = schema.safeParse({ ...input, requiresKyc, requireSelfie: true })

      expect(parsed.success).toBe(false)
      if (parsed.success) continue
      expect(parsed.error.issues).toContainEqual(
        expect.objectContaining({ path: ["requireSelfie"], message: SELFIE_REQUIRES_IDENTITY_MESSAGE })
      )
      expect(getVendorTransactionParseErrorCode(parsed.error)).toBe("selfie_requires_identity")
    }
  })

  it("accepts requireSelfie with requiresKyc", () => {
    const parsed = schema.safeParse({ ...input, requiresKyc: true, requireSelfie: true })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.requiresKyc).toBe(true)
    expect(parsed.data.requireSelfie).toBe(true)
  })

  it("defaults requireSelfie to false when omitted", () => {
    const parsed = schema.safeParse({ ...input, requiresKyc: true })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.requireSelfie).toBe(false)
  })
})

describe("getVendorTransactionParseErrorCode", () => {
  it("returns no code for unrelated parse errors", () => {
    const parsed = vendorTransactionCreateSchema.safeParse({ ...BASE_INPUT, title: "" })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(getVendorTransactionParseErrorCode(parsed.error)).toBeUndefined()
  })
})
