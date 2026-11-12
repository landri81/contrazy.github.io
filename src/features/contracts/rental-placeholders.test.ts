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

describe("departure readings (LOCAZ M11.1, contract signed at pickup)", () => {
  it("prints the check-in mileage, fuel, time and damage; empty before the check-in", () => {
    expect(buildRentalPlaceholderValues(context, "fr")["{{rental.departureKm}}"]).toBe("")
    const departure = { inspectedAt: "2026-11-02T07:45:00.000Z", odometerKm: 48_210, fuelEighths: 6 }
    const values = buildRentalPlaceholderValues({ ...context, rentalDetails: { ...payload.rental, departure } }, "fr")
    expect(values["{{rental.departureKm}}"]).toBe("48 210 km")
    expect(values["{{rental.departureFuel}}"]).toBe("6/8")
    expect(values["{{rental.departureAt}}"]).toContain("02 novembre 2026")
    expect(values["{{rental.departureAt}}"]).toContain("08:45")
    expect(values["{{rental.departureDamages}}"]).toBe("Aucun dommage signalé")
    const damaged = buildRentalPlaceholderValues({ ...context, rentalDetails: { ...payload.rental, departure: { ...departure, damages: "Rayure arrière" } } }, "en")
    expect(damaged["{{rental.departureDamages}}"]).toBe("Rayure arrière")
  })

  it("says the readings in one sentence, and leaves its paragraph out before the check-in", () => {
    const departure = { inspectedAt: "2026-11-02T07:45:00.000Z", odometerKm: 48_210, fuelEighths: 6 }
    const template = "<p>1.1 - Nature</p><p>{{rental.departureReport}}</p><p>1.2 - État</p>"
    const signed = applyRentalPlaceholders(template, { ...context, rentalDetails: { ...payload.rental, departure } }, "fr")
    expect(signed).toContain("État des lieux de départ du 02 novembre 2026")
    expect(signed).toContain("kilométrage 48 210 km, carburant 6/8. Dommages constatés : Aucun dommage signalé.")
    expect(applyRentalPlaceholders(template, context, "fr")).toBe("<p>1.1 - Nature</p><p>1.2 - État</p>")
  })
})

describe("the partner's contact numbers (LOCAZ D-09, M13.13)", () => {
  it("prints the lessor's phone and the assistance line the partner sends, empty when it sends none", () => {
    const values = buildRentalPlaceholderValues({ ...context, rentalDetails: { ...payload.rental, lessorPhone: "07 44 71 22 73", assistancePhone: "+33 1 41 85 85 85" } }, "fr")
    expect(values["{{rental.lessorPhone}}"]).toBe("07 44 71 22 73")
    expect(values["{{rental.assistancePhone}}"]).toBe("+33 1 41 85 85 85")
    expect(buildRentalPlaceholderValues(context, "fr")["{{rental.assistancePhone}}"]).toBe("")
  })
})

describe("price lines with the detail in their label (LOCAZ)", () => {
  it("prints one unit without a unit of its own as label and amount, in French spacing", () => {
    const rentalDetails = { ...payload.rental, priceLines: [{ label: "Attelage", quantity: 1, unit: "item", unitAmount: 1500, total: 1500 }, { label: "Location, 3 jours", quantity: 1, unitAmount: 15000, total: 15000 }] }
    const table = buildRentalPlaceholderValues({ ...context, rentalDetails }, "fr")["{{rental.priceTable}}"]
    expect(table).toContain("Attelage : 15,00 €")
    expect(table).toContain("Location, 3 jours : 150,00 €")
    expect(table).toContain("Total : 165,00 €")
    expect(table).not.toContain("item")
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

describe("contract fields for the vehicle, the drivers and the company (LOCAZ, 12 Nov 2026)", () => {
  const rental = {
    ...payload.rental,
    vehicle: { ...payload.rental.vehicle, category: "Utilitaire 3 m³", fuel: "Diesel" },
    drivers: { mainLicenceNumber: "12AB34567", extra: [{ firstName: "Marie", lastName: "Durand", licenceNumber: "98CD76543" }, { firstName: "Paul", lastName: "Martin" }] },
    company: { name: "Transports Exemple SAS", siret: "12345678900012", vatNumber: "FR12345678900" },
    termsUrl: "https://locaz.example/legal/terms?v=1&lang=fr",
    lateFee: "15,00 € par heure commencée, au plus 90,00 € par jour",
  }

  it("fills the category, fuel, licences, extra drivers, company and late fee (fr)", () => {
    const values = buildRentalPlaceholderValues({ ...context, rentalDetails: rental }, "fr")

    expect(values["{{rental.category}}"]).toBe("Utilitaire 3 m³")
    expect(values["{{rental.fuel}}"]).toBe("Diesel")
    expect(values["{{rental.mainDriverLicence}}"]).toBe("12AB34567")
    expect(values["{{rental.extraDrivers}}"]).toBe("Conducteurs secondaires autorisés : Marie Durand (permis n° 98CD76543); Paul Martin.")
    expect(values["{{rental.company}}"]).toBe("Pour le compte de la société Transports Exemple SAS (SIRET 12345678900012, n° de TVA FR12345678900).")
    expect(values["{{rental.companyName}}"]).toBe("Transports Exemple SAS")
    expect(values["{{rental.companySiret}}"]).toBe("12345678900012")
    expect(values["{{rental.companyVat}}"]).toBe("FR12345678900")
    expect(values["{{rental.lateFee}}"]).toBe("15,00 € par heure commencée, au plus 90,00 € par jour")
  })

  it("says no extra driver is authorised when the partner sends none, and stays empty when it sends nothing", () => {
    const none = { ...rental, drivers: { extra: [] } }
    expect(buildRentalPlaceholderValues({ ...context, rentalDetails: none }, "fr")["{{rental.extraDrivers}}"]).toBe("Aucun conducteur secondaire autorisé.")
    expect(buildRentalPlaceholderValues({ ...context, rentalDetails: none }, "en")["{{rental.extraDrivers}}"]).toBe("No additional driver authorised.")
    expect(buildRentalPlaceholderValues(context, "fr")["{{rental.extraDrivers}}"]).toBe("")
    expect(buildRentalPlaceholderValues(context, "fr")["{{rental.fuel}}"]).toBe("")
  })

  it("prints the terms as an escaped link the signer can open, kept by the contract sanitiser", () => {
    const html = renderContractContent({ templateContent: "<p>CGV : {{rental.termsLink}}</p>", transactionReference: "TX-3", locale: "fr", rental: { ...context, rentalDetails: rental } })

    expect(html).toContain('<a href="https://locaz.example/legal/terms?v=1&amp;lang=fr" target="_blank" rel="noreferrer noopener">https://locaz.example/legal/terms?v=1&amp;lang=fr</a>')
    expect(html).not.toContain("{{")
  })

  it("leaves out the company and drivers lines when the partner sent nothing for them", () => {
    const template = "<p>A</p><p>{{rental.company}}</p><p>{{rental.extraDrivers}}</p><p>B</p>"
    expect(applyRentalPlaceholders(template, context, "fr")).toBe("<p>A</p><p>B</p>")
    const person = { ...rental, company: undefined, drivers: { extra: [] } }
    expect(applyRentalPlaceholders(template, { ...context, rentalDetails: person }, "en")).toBe("<p>A</p><p>No additional driver authorised.</p><p>B</p>")
  })

  it("refuses a terms address that is not https", () => {
    expect(buildRentalPlaceholderValues({ ...context, rentalDetails: { ...rental, termsUrl: "http://locaz.example/terms" } }, "fr")["{{rental.termsLink}}"]).toBe("")
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
