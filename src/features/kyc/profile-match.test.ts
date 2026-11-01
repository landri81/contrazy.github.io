import { describe, expect, it } from "vitest"

import { matchIdentityToProfile } from "./profile-match"

const profile = { firstName: "Jean-Pierre", lastName: "Lefèvre", birthDate: "1988-05-20" }

describe("matchIdentityToProfile (QA V-03)", () => {
  it("matches the same person whatever the case, accents, hyphens or extra given names", () => {
    expect(matchIdentityToProfile({ firstName: "JEAN PIERRE", lastName: "LEFEVRE", dob: "1988-05-20" }, profile)).toEqual({ status: "matched" })
    expect(matchIdentityToProfile({ firstName: "Jean Pierre Marie", lastName: "Lefèvre", dob: "1988-05-20" }, profile)).toEqual({ status: "matched" })
    expect(matchIdentityToProfile({ firstName: "Pierre", lastName: "LEFEVRE", dob: null }, profile)).toEqual({ status: "matched" })
    expect(matchIdentityToProfile({ firstName: "Claire", lastName: "D'AMICO", dob: null }, { firstName: "Claire", lastName: "Damico", birthDate: null })).toEqual({ status: "matched" })
    expect(matchIdentityToProfile({ firstName: "Claire", lastName: "RECETTEPRO", dob: null }, { firstName: "Claire", lastName: "Recette-Pro", birthDate: null })).toEqual({ status: "matched" })
    expect(matchIdentityToProfile({ firstName: "Claire", lastName: "Recette-Pro", dob: null }, { firstName: "Claire", lastName: "Recette Pro", birthDate: null })).toEqual({ status: "matched" })
  })

  it("matches when the document puts every name in one field", () => {
    expect(matchIdentityToProfile({ firstName: null, lastName: "LEFEVRE JEAN PIERRE", dob: "1988-05-20" }, profile)).toEqual({ status: "matched" })
  })

  it("refuses another person's name or birth date", () => {
    expect(matchIdentityToProfile({ firstName: "Jean", lastName: "Autre", dob: "1988-05-20" }, profile)).toEqual({ status: "mismatch", reason: "name" })
    expect(matchIdentityToProfile({ firstName: "Marc", lastName: "Lefevre", dob: "1988-05-20" }, profile)).toEqual({ status: "mismatch", reason: "name" })
    expect(matchIdentityToProfile({ firstName: "Jean-Pierre", lastName: "Lefevre", dob: "1990-01-01" }, profile)).toEqual({ status: "mismatch", reason: "birth_date" })
  })

  it("skips when there is nothing to compare", () => {
    expect(matchIdentityToProfile(null, profile)).toEqual({ status: "skipped", reason: "no_verified_outputs" })
    expect(matchIdentityToProfile({ firstName: null, lastName: null, dob: null }, profile)).toEqual({ status: "skipped", reason: "no_verified_outputs" })
    expect(matchIdentityToProfile({ firstName: "Jean", lastName: "Lefevre", dob: null }, { firstName: null, lastName: "Lefevre", birthDate: null })).toEqual({ status: "skipped", reason: "no_profile_name" })
  })
})
