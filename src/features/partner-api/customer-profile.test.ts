import { describe, expect, it } from "vitest"

import { clientProfileFromPartnerCustomer } from "./customer-profile"

describe("clientProfileFromPartnerCustomer", () => {
  it("keeps the address on one line with its country, and the birth date and place", () => {
    expect(
      clientProfileFromPartnerCustomer({
        firstName: "Lina",
        lastName: "Martin",
        email: "lina@locaz.test",
        phone: "+33612345678",
        locale: "fr",
        address: { line1: "12 rue de France", postalCode: "06000", city: "Nice", country: "FR" },
        birthDate: "1988-05-20",
        birthPlace: "Nice",
      })
    ).toEqual({
      firstName: "Lina",
      lastName: "Martin",
      fullName: "Lina Martin",
      email: "lina@locaz.test",
      phone: "+33612345678",
      address: "12 rue de France, 06000 Nice",
      country: "FR",
      birthDate: new Date("1988-05-20T00:00:00.000Z"),
      birthCity: "Nice",
    })
  })

  it("leaves them empty when the partner sends only the name and contact (Contrazy's pages then ask)", () => {
    expect(clientProfileFromPartnerCustomer({ firstName: "Lina", lastName: "Martin", email: "lina@locaz.test", locale: "en" })).toMatchObject({ phone: null, address: null, country: null, birthDate: null, birthCity: null })
  })
})
