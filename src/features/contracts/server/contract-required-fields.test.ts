import { describe, expect, it } from "vitest"

import type { ContractRentalContext } from "@/features/contracts/rental-placeholders"
import { emptyContractFields } from "@/features/contracts/server/contract-rendering"
import { buildBookingPayload } from "@/features/partner-api/__fixtures__/booking-payload"

/** LOCAZ QA V-04: a rental contract is never signed with a required field left blank. */

const payload = buildBookingPayload()
const rental: ContractRentalContext = { rentalDetails: payload.rental, startAt: new Date(payload.startAt), endAt: new Date(payload.endAt), timezone: "Europe/Paris", currency: "EUR" }
const clientProfile = { fullName: "Claire Recette", firstName: "Claire", lastName: "Recette", birthCity: "Nice", birthDate: new Date("1988-05-20T00:00:00Z"), email: "claire@locaz.test", address: "12 rue de France, 06000 Nice" }
const TEMPLATE =
  "<p>{{clientFirstName}} {{clientLastName}}, né(e) le {{clientBirthDate}} à {{clientBirthCity}}, {{clientAddress}}</p>" +
  "<p>{{rental.vehicle}} {{rental.plate}} du {{rental.start}} au {{rental.end}}, {{rental.pickupPlace}} → {{rental.returnPlace}}</p>" +
  "<p>{{rental.protection}} {{rental.deductible}} {{rental.deposit}}</p>"

const input = (overrides: Record<string, unknown> = {}) => ({
  templateContent: TEMPLATE,
  clientProfile,
  vendorName: "LOCAZ",
  transactionReference: "TX-1",
  amount: 15_700,
  depositAmount: 0,
  locale: "fr",
  rental,
  ...overrides,
}) as Parameters<typeof emptyContractFields>[0]

describe("emptyContractFields (QA V-04)", () => {
  it("finds nothing missing on a complete booking", () => {
    expect(emptyContractFields(input())).toEqual([])
  })

  it("lists the required fields the booking would leave blank", () => {
    const noPlate = { ...rental, rentalDetails: { ...payload.rental, vehicle: { ...payload.rental.vehicle, plate: undefined } } }
    expect(emptyContractFields(input({ rental: noPlate }))).toEqual(["{{rental.plate}}"])
    expect(emptyContractFields(input({ clientProfile: { ...clientProfile, birthDate: null, birthCity: " " } }))).toEqual(["{{clientBirthDate}}", "{{clientBirthCity}}"])
    expect(emptyContractFields(input({ rental: { ...rental, rentalDetails: null, startAt: null, endAt: null } }))).toEqual([
      "{{rental.vehicle}}",
      "{{rental.plate}}",
      "{{rental.start}}",
      "{{rental.end}}",
      "{{rental.pickupPlace}}",
      "{{rental.returnPlace}}",
      "{{rental.protection}}",
      "{{rental.deductible}}",
      "{{rental.deposit}}",
    ])
  })

  it("ignores fields the template does not use", () => {
    expect(emptyContractFields(input({ templateContent: "<p>{{clientFirstName}}</p>", clientProfile: { ...clientProfile, birthDate: null } }))).toEqual([])
  })
})
