import { describe, expect, it } from "vitest"

import { buildBookingPayload } from "@/features/partner-api/__fixtures__/booking-payload"
import {
  parseRentalDetails,
  partnerBookingCreateSchema,
  partnerBookingUpdateSchema,
} from "@/features/partner-api/schemas/booking.schema"

function issuesOf(payload: unknown) {
  const parsed = partnerBookingCreateSchema.safeParse(payload)
  return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
}

describe("partnerBookingCreateSchema", () => {
  it("accepts a complete rental booking and applies defaults", () => {
    const parsed = partnerBookingCreateSchema.parse(buildBookingPayload({ timezone: undefined, currency: undefined }))

    expect(parsed.timezone).toBe("Europe/Paris")
    expect(parsed.currency).toBe("EUR")
    expect(parsed.customer.email).toBe("alice.martin@locaz.test")
    expect(parsed.rental.priceLines).toHaveLength(2)
  })

  it("refuses endAt equal to or before startAt", () => {
    expect(issuesOf(buildBookingPayload({ endAt: "2026-11-02T09:00:00+01:00" }))).toContain("endAt: endAt must be after startAt")
    expect(issuesOf(buildBookingPayload({ endAt: "2026-11-01T09:00:00+01:00" }))).toContain("endAt: endAt must be after startAt")
  })

  it("compares instants across offsets, not wall-clock text", () => {
    // 09:30 in Paris is 08:30Z, so 08:45Z is later even though it reads earlier.
    const payload = buildBookingPayload({ startAt: "2026-11-02T09:30:00+01:00", endAt: "2026-11-02T08:45:00Z" })
    expect(issuesOf(payload)).toEqual([])
  })

  it("requires ISO 8601 date-times with an offset", () => {
    expect(issuesOf(buildBookingPayload({ startAt: "2026-11-02 09:00" }))[0]).toMatch(/^startAt: .*ISO 8601/)
    expect(issuesOf(buildBookingPayload({ startAt: "2026-11-02T09:00:00" }))[0]).toMatch(/^startAt: /)
  })

  it("accepts IANA time zones only", () => {
    expect(issuesOf(buildBookingPayload({ timezone: "America/New_York" }))).toEqual([])
    expect(issuesOf(buildBookingPayload({ timezone: "UTC" }))).toEqual([])
    expect(issuesOf(buildBookingPayload({ timezone: "CET" }))[0]).toMatch(/^timezone: /)
    expect(issuesOf(buildBookingPayload({ timezone: "Mars/Olympus_Mons" }))[0]).toMatch(/^timezone: /)
    expect(issuesOf(buildBookingPayload({ timezone: "+01:00" }))[0]).toMatch(/^timezone: /)
  })

  it("validates amounts as positive whole cents", () => {
    expect(issuesOf(buildBookingPayload({ amount: 12.5 }))[0]).toMatch(/^amount: .*whole number of cents/)
    expect(issuesOf(buildBookingPayload({ amount: -100 }))[0]).toMatch(/^amount: /)
    expect(issuesOf(buildBookingPayload({ amount: 0 }))[0]).toMatch(/^amount: .*greater than zero/)
    expect(issuesOf(buildBookingPayload({ depositAmount: "800" }))[0]).toMatch(/^depositAmount: /)
    expect(issuesOf(buildBookingPayload({ amount: 100_000_001 }))[0]).toMatch(/^amount: .*too large/)
  })

  it("requires the amounts of the money steps that are on", () => {
    expect(issuesOf(buildBookingPayload({ amount: null }))).toContain("amount: amount is required when steps.payment is on")
    expect(issuesOf(buildBookingPayload({ depositAmount: undefined }))).toContain(
      "depositAmount: depositAmount is required when steps.hold is on"
    )
    expect(
      issuesOf(buildBookingPayload({ amount: null, depositAmount: null, steps: { payment: false, hold: false } }))
    ).toEqual([])
  })

  it("checks price line totals and rental amounts", () => {
    const rental = buildBookingPayload().rental
    const badLine = { ...rental, priceLines: [{ label: "Rental", quantity: 3, unitAmount: 4500, total: 13000 }] }
    expect(issuesOf(buildBookingPayload({ rental: badLine }))).toContain(
      "rental.priceLines.0.total: total must equal quantity x unitAmount"
    )
    expect(issuesOf(buildBookingPayload({ rental: { ...rental, deductible: -1 } }))[0]).toMatch(/^rental\.deductible: /)
    expect(
      issuesOf(buildBookingPayload({ rental: { ...rental, mileage: { unlimited: false } } }))
    ).toContain("rental.mileage.includedKm: includedKm is required unless mileage is unlimited")
  })

  it("refuses unknown step names, EUR-only currency and an unsupported locale", () => {
    expect(issuesOf(buildBookingPayload({ steps: { identty: true } }))[0]).toMatch(/^steps: /)
    expect(issuesOf(buildBookingPayload({ currency: "USD" }))[0]).toBe("currency: Only EUR is supported")
    const customer = { ...buildBookingPayload().customer, locale: "de" }
    expect(issuesOf(buildBookingPayload({ customer }))[0]).toMatch(/^customer\.locale: /)
  })

  it("accepts the it locale (the flow falls back to en)", () => {
    const customer = { ...buildBookingPayload().customer, locale: "it" }
    expect(partnerBookingCreateSchema.parse(buildBookingPayload({ customer })).customer.locale).toBe("it")
  })

  it("requires identity for selfie and an http(s) returnUrl", () => {
    expect(issuesOf(buildBookingPayload({ steps: { selfie: true } }))).toContain("steps.selfie: steps.selfie requires steps.identity")
    expect(issuesOf(buildBookingPayload({ returnUrl: "javascript:alert(1)" }))[0]).toMatch(/^returnUrl: /)
  })
})

describe("partnerBookingUpdateSchema", () => {
  it("needs at least one known field", () => {
    expect(partnerBookingUpdateSchema.safeParse({}).success).toBe(false)
    expect(partnerBookingUpdateSchema.safeParse({ externalRef: "x" }).success).toBe(false)
    expect(partnerBookingUpdateSchema.safeParse({ steps: { checkOut: false } }).success).toBe(true)
  })
})

describe("parseRentalDetails", () => {
  it("returns null for missing or malformed stored data", () => {
    expect(parseRentalDetails(null)).toBeNull()
    expect(parseRentalDetails({ vehicle: {} })).toBeNull()
    expect(parseRentalDetails(buildBookingPayload().rental)?.vehicle.plate).toBe("AB-123-CD")
  })
})
