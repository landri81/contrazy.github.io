import { describe, expect, it } from "vitest"

import { PARTNER_CHARGE_TYPES, partnerChargeCreateSchema } from "./card-charges.schema"

/** Charge bodies (C6), with the return fees of the rental agreement since C10 (for LOCAZ M8.1). */
describe("partnerChargeCreateSchema", () => {
  it("accepts every partner charge type, the return fees included, and maps them to the stored enum", () => {
    expect(PARTNER_CHARGE_TYPES).toEqual(["damage", "fuel", "toll", "towing", "fps", "ticket_admin_fee", "late_return", "extra_km", "cleaning", "other"])
    for (const type of ["late_return", "extra_km", "cleaning"]) {
      const parsed = partnerChargeCreateSchema.safeParse({ type, amount: 4_500, description: "3 h × 15,00 €" })
      expect(parsed.success).toBe(true)
      expect(type.toUpperCase()).toMatch(/^(LATE_RETURN|EXTRA_KM|CLEANING)$/)
    }
  })

  it("refuses an unknown type and amounts that are not whole positive cents", () => {
    expect(partnerChargeCreateSchema.safeParse({ type: "parking", amount: 1_000 }).success).toBe(false)
    expect(partnerChargeCreateSchema.safeParse({ type: "cleaning", amount: 0 }).success).toBe(false)
    expect(partnerChargeCreateSchema.safeParse({ type: "cleaning", amount: 60.5 }).success).toBe(false)
  })
})
