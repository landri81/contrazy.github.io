import { describe, expect, it } from "vitest"

import { buildBookingPayload } from "@/features/partner-api/__fixtures__/booking-payload"
import {
  applyRentalPlaceholders,
  buildRentalPlaceholderValues,
  clearUnknownPlaceholders,
  RENTAL_PLACEHOLDER_TOKENS,
  type ContractRentalContext,
} from "@/features/contracts/rental-placeholders"
import { renderContractContent } from "@/features/contracts/server/contract-rendering"

const payload = buildBookingPayload()

const context: ContractRentalContext = {
  rentalDetails: payload.rental,
  startAt: new Date(payload.startAt),
  endAt: new Date(payload.endAt),
  timezone: "Europe/Paris",
  currency: "EUR",
}

describe("buildRentalPlaceholderValues", () => {
  it("fills every rental placeholder from the booking (en)", () => {
    const values = buildRentalPlaceholderValues(context, "en")

    expect(values["{{rental.vehicle}}"]).toBe("Peugeot 208 (Compact)")
    expect(values["{{rental.plate}}"]).toBe("AB-123-CD")
    expect(values["{{rental.start}}"]).toBe("02 November 2026 at 09:00 (Europe/Paris)")
    expect(values["{{rental.end}}"]).toBe("05 November 2026 at 18:00 (Europe/Paris)")
    expect(values["{{rental.pickupPlace}}"]).toBe("Nice Airport T2, Rue Costes et Bellonte, 06200 Nice")
    expect(values["{{rental.returnPlace}}"]).toBe("Nice Airport T2")
    expect(values["{{rental.kmIncluded}}"]).toBe("900 km (€0.25 per extra km)")
    expect(values["{{rental.options}}"]).toBe("Child seat, Additional driver")
    expect(values["{{rental.protection}}"]).toBe("Standard protection")
    expect(values["{{rental.deductible}}"]).toBe("€1,200.00")
    expect(values["{{rental.deposit}}"]).toBe("€800.00")
    expect(values["{{rental.priceTable}}"]).toContain("Total: €150.00")
  })

  it("formats dates and money in the booking timezone and the fr locale", () => {
    const values = buildRentalPlaceholderValues({ ...context, timezone: "America/New_York" }, "fr")

    // 09:00 in Paris (UTC+1) is 03:00 in New York (UTC-5).
    expect(values["{{rental.start}}"]).toBe("02 novembre 2026 à 03:00 (America/New_York)")
    expect(values["{{rental.deposit}}"]).toBe("800,00 €")
    expect(values["{{rental.kmIncluded}}"]).toBe("900 km (0,25 € par km supplémentaire)")
  })

  it("shows unlimited mileage", () => {
    const values = buildRentalPlaceholderValues(
      { ...context, rentalDetails: { ...payload.rental, mileage: { unlimited: true } } },
      "fr"
    )

    expect(values["{{rental.kmIncluded}}"]).toBe("Kilométrage illimité")
  })

  it("renders every placeholder empty without rental data", () => {
    const values = buildRentalPlaceholderValues(null, "en")

    for (const token of RENTAL_PLACEHOLDER_TOKENS) {
      expect(values[token]).toBe("")
    }

    expect(buildRentalPlaceholderValues({ ...context, rentalDetails: { vehicle: "broken" } }, "en")["{{rental.plate}}"]).toBe("")
  })
})

describe("applyRentalPlaceholders", () => {
  it("escapes values and renders a standalone price table as a list", () => {
    const html = applyRentalPlaceholders(
      "<p>{{rental.vehicle}}</p><p>{{rental.priceTable}}</p>",
      { ...context, rentalDetails: { ...payload.rental, vehicle: { model: "<b>208</b>" } } },
      "en"
    )

    expect(html).toContain("&lt;b&gt;208&lt;/b&gt;")
    expect(html).toMatch(/^<p>.*<\/p><ul><li>Rental — 3 days × €45\.00 = €135\.00<\/li>.*<strong>Total: €150\.00<\/strong><\/li><\/ul>$/)
  })

  it("clears unknown placeholders instead of crashing", () => {
    expect(clearUnknownPlaceholders("<p>A{{rental.colour}}B{{ unknown.token }}C</p>")).toBe("<p>ABC</p>")
  })
})

describe("renderContractContent with rental placeholders", () => {
  const template =
    "<p>{{rental.vehicle}} / {{rental.plate}} / {{rental.start}}</p><p>{{rental.priceTable}}</p><p>X{{rental.unknown}}Y{{nothing}}Z</p><p>{{transactionReference}}</p>"

  it("renders rental data and empties unknown tokens", () => {
    const html = renderContractContent({ templateContent: template, transactionReference: "TX-1", locale: "en", rental: context })

    expect(html).toContain("Peugeot 208 (Compact) / AB-123-CD / 02 November 2026 at 09:00 (Europe/Paris)")
    expect(html).toContain("<li>")
    expect(html).toContain("XYZ")
    expect(html).toContain("TX-1")
    expect(html).not.toContain("{{")
  })

  it("renders a dashboard transaction (no rental data) without crashing", () => {
    const html = renderContractContent({ templateContent: template, transactionReference: "TX-2", locale: "fr" })

    expect(html).toContain("<p> /  / </p>")
    expect(html).toContain("XYZ")
    expect(html).not.toContain("{{")
  })
})
