import { describe, expect, it } from "vitest"

import { buildBookingPayload } from "@/features/partner-api/__fixtures__/booking-payload"
import { buildBookingLaunchInput, resolveBookingStepSwitches } from "@/features/partner-api/booking-launch"
import { partnerBookingCreateSchema } from "@/features/partner-api/schemas/booking.schema"
import { getNotRequiredClientSteps, isStepSwitchedOff, mergeStepSwitches, parseStepSwitches } from "@/features/transactions/step-switches"
import { PartnerApiError } from "@/lib/partner-api/errors"

function parse(overrides: Record<string, unknown> = {}) {
  return partnerBookingCreateSchema.parse(buildBookingPayload(overrides))
}

describe("buildBookingLaunchInput", () => {
  it("maps every switched-on step onto the dashboard launch input", () => {
    const input = buildBookingLaunchInput(parse(), { contractTemplateId: "tpl_1" })

    expect(input.requiresKyc).toBe(true)
    expect(input.contractTemplateId).toBe("tpl_1")
    expect(input.amount).toBe(15000)
    expect(input.depositAmount).toBe(80000)
    expect(input.flowType).toBe("CHECK_IN_OUT")
    expect(input.requirements).toHaveLength(1)
    expect(input.reportFields.map((field) => field.reportType)).toEqual([
      "CHECK_IN",
      "CHECK_IN",
      "CHECK_IN",
      "CHECK_IN",
      "CHECK_OUT",
      "CHECK_OUT",
      "CHECK_OUT",
      "CHECK_OUT",
    ])
    expect(input.serviceDate?.toISOString()).toBe("2026-11-02T00:00:00.000Z")
    expect(input.title).toBe("Peugeot 208 · LZ-TEST-0001")
  })

  it("contributes no configuration for switched-off steps (no report fields when check-in/out are off)", () => {
    const input = buildBookingLaunchInput(parse({ steps: { identity: false, payment: true } }), { contractTemplateId: "tpl_1" })

    expect(input.requiresKyc).toBe(false)
    expect(input.contractTemplateId).toBeNull()
    expect(input.depositAmount).toBeNull()
    expect(input.requirements).toEqual([])
    expect(input.reportFields).toEqual([])
    expect(input.flowType).toBe("STANDARD")
  })

  it("keeps check-out fields only when check-in is off", () => {
    const input = buildBookingLaunchInput(parse({ steps: { checkOut: true } }), { contractTemplateId: null })

    expect(new Set(input.reportFields.map((field) => field.reportType))).toEqual(new Set(["CHECK_OUT"]))
  })

  it("uses English default copy for the it locale", () => {
    const input = buildBookingLaunchInput(
      parse({ customer: { ...buildBookingPayload().customer, locale: "it" } }),
      { contractTemplateId: null }
    )

    expect(input.requirements[0]?.label).toBe("Driving licence")
  })

  it("maps steps.selfie onto requireSelfie (C4), off by default", () => {
    expect(buildBookingLaunchInput(parse({ steps: { identity: true, selfie: true } }), { contractTemplateId: null })).toMatchObject({
      requiresKyc: true,
      requireSelfie: true,
    })
    expect(buildBookingLaunchInput(parse({ steps: { identity: true } }), { contractTemplateId: null })).toMatchObject({
      requiresKyc: true,
      requireSelfie: false,
    })
  })

  it("refuses card security until its launch settings exist", () => {
    const booking = parse({ steps: { cardSecurity: true } })

    expect(() => buildBookingLaunchInput(booking, { contractTemplateId: null })).toThrow(PartnerApiError)

    try {
      buildBookingLaunchInput(booking, { contractTemplateId: null })
    } catch (error) {
      expect((error as PartnerApiError).code).toBe("step_requires_configuration")
      expect((error as PartnerApiError).status).toBe(422)
      expect((error as PartnerApiError).details).toEqual({ steps: ["steps.cardSecurity"] })
    }
  })
})

describe("step switches", () => {
  it("parses stored JSON and treats dashboard transactions (null) as legacy", () => {
    expect(parseStepSwitches(null)).toBeNull()
    expect(parseStepSwitches([])).toBeNull()
    expect(parseStepSwitches({ identity: true, documents: "yes" })).toMatchObject({ identity: true, documents: false })
    expect(isStepSwitchedOff(null, "documents")).toBe(false)
    expect(isStepSwitchedOff(parseStepSwitches({}), "documents")).toBe(true)
  })

  it("merges a partial PATCH onto the current switches", () => {
    const current = resolveBookingStepSwitches({ identity: true, payment: true })
    expect(mergeStepSwitches(current, { payment: false, checkIn: true })).toMatchObject({
      identity: true,
      payment: false,
      checkIn: true,
    })
  })

  it("lists switched-off client steps as not required, none for dashboard transactions", () => {
    expect(getNotRequiredClientSteps(null)).toEqual([])
    expect(getNotRequiredClientSteps(resolveBookingStepSwitches({ identity: true, hold: true }))).toEqual([
      "documents",
      "contract",
      "sign",
      "check-in",
      "check-out",
    ])
  })
})
