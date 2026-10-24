import { describe, expect, it } from "vitest"

import { formatDateOnlyValue, parseDateOnlyInput, toDateOnlyInputValue } from "@/lib/date-only"

describe("date-only helpers", () => {
  it("parses YYYY-MM-DD as UTC midnight and rejects other shapes", () => {
    expect(parseDateOnlyInput(" 2026-11-01 ")?.toISOString()).toBe("2026-11-01T00:00:00.000Z")
    expect(parseDateOnlyInput("01/11/2026")).toBeNull()
    expect(parseDateOnlyInput("2026-11-01T10:00")).toBeNull()
  })

  it("formats dates back to input values", () => {
    expect(toDateOnlyInputValue(new Date("2026-11-01T15:30:00.000Z"))).toBe("2026-11-01")
    expect(toDateOnlyInputValue("2026-11-01")).toBe("2026-11-01")
    expect(toDateOnlyInputValue("not a date")).toBe("")
    expect(toDateOnlyInputValue(null)).toBe("")
    expect(toDateOnlyInputValue(new Date("invalid"))).toBe("")
  })

  it("formats per locale without shifting the day", () => {
    expect(formatDateOnlyValue("2026-11-01", "fr")).toMatch(/01/)
    expect(formatDateOnlyValue("2026-11-01", "en")).toMatch(/2026/)
    expect(formatDateOnlyValue(undefined, "en")).toBe("")
  })
})
