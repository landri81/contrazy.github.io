import { describe, expect, it } from "vitest"

import {
  isBookingLocked,
  isReturnUrlAllowed,
  isValidIanaTimezone,
  resolveFlowLocale,
  serviceDateFromStartAt,
} from "@/lib/partner-api/bookings"

describe("isBookingLocked (step-lock rule)", () => {
  const activeLink = { status: "ACTIVE" as const, openedAt: null }

  it("is unlocked while the link is sent and never opened", () => {
    expect(isBookingLocked({ status: "LINK_SENT", link: activeLink })).toBe(false)
    expect(isBookingLocked({ status: "DRAFT", link: null })).toBe(false)
  })

  it("locks as soon as the customer opened the link", () => {
    expect(isBookingLocked({ status: "LINK_SENT", link: { status: "ACTIVE", openedAt: new Date() } })).toBe(true)
  })

  it("locks once the transaction moved past LINK_SENT", () => {
    for (const status of ["CUSTOMER_STARTED", "DOCS_SUBMITTED", "SIGNED", "COMPLETED", "CANCELLED"] as const) {
      expect(isBookingLocked({ status, link: activeLink })).toBe(true)
    }
  })

  it("locks when the link is no longer active", () => {
    expect(isBookingLocked({ status: "LINK_SENT", link: { status: "CANCELLED", openedAt: null } })).toBe(true)
  })
})

describe("isReturnUrlAllowed", () => {
  const allowed = ["https://locaz.co", "https://staging.locaz.co/", "http://localhost:3000"]

  it("accepts URLs on an allowed origin", () => {
    expect(isReturnUrlAllowed("https://locaz.co/bookings/LZ-1?done=1", allowed)).toBe(true)
    expect(isReturnUrlAllowed("https://staging.locaz.co/return", allowed)).toBe(true)
    expect(isReturnUrlAllowed("http://localhost:3000/b", allowed)).toBe(true)
  })

  it("refuses other hosts, schemes, ports and look-alike domains", () => {
    expect(isReturnUrlAllowed("https://evil.test/locaz.co", allowed)).toBe(false)
    expect(isReturnUrlAllowed("https://locaz.co.evil.test/", allowed)).toBe(false)
    expect(isReturnUrlAllowed("http://locaz.co/", allowed)).toBe(false)
    expect(isReturnUrlAllowed("http://localhost:3001/", allowed)).toBe(false)
    expect(isReturnUrlAllowed("javascript:alert(1)", allowed)).toBe(false)
    expect(isReturnUrlAllowed("not a url", allowed)).toBe(false)
  })

  it("refuses everything when the vendor allow-list is empty", () => {
    expect(isReturnUrlAllowed("https://locaz.co/", [])).toBe(false)
  })
})

describe("resolveFlowLocale", () => {
  it("keeps fr and en and falls back from it to en", () => {
    expect(resolveFlowLocale("fr")).toBe("fr")
    expect(resolveFlowLocale("en")).toBe("en")
    expect(resolveFlowLocale("it")).toBe("en")
  })
})

describe("booking dates", () => {
  it("accepts IANA zones and refuses abbreviations", () => {
    expect(isValidIanaTimezone("Europe/Paris")).toBe(true)
    expect(isValidIanaTimezone("UTC")).toBe(true)
    expect(isValidIanaTimezone("CET")).toBe(false)
    expect(isValidIanaTimezone("Mars/Olympus")).toBe(false)
  })

  it("sets serviceDate from the local date part of startAt", () => {
    // 23:30 UTC on 1 Nov is already 2 Nov in Paris.
    expect(serviceDateFromStartAt(new Date("2026-11-01T23:30:00Z"), "Europe/Paris").toISOString()).toBe(
      "2026-11-02T00:00:00.000Z"
    )
    expect(serviceDateFromStartAt(new Date("2026-11-01T23:30:00Z"), "UTC").toISOString()).toBe("2026-11-01T00:00:00.000Z")
  })
})
