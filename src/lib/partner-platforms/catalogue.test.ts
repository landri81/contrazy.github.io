import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/env", () => ({ env: {} }))

const { getPartnerPlatform, originWithTwin } = await import("./catalogue")

/** A platform answers on its www and bare domain (locaz.co redirects to www.locaz.co): both are allowed. */
describe("originWithTwin", () => {
  it("pairs the www origin with the bare domain, and the other way round", () => {
    expect(originWithTwin("https://www.locaz.co")).toEqual(["https://www.locaz.co", "https://locaz.co"])
    expect(originWithTwin("https://locaz.co")).toEqual(["https://locaz.co", "https://www.locaz.co"])
  })

  it("keeps a local address as it is", () => {
    expect(originWithTwin("http://localhost:3100")).toEqual(["http://localhost:3100"])
    expect(originWithTwin("http://127.0.0.1:3100")).toEqual(["http://127.0.0.1:3100"])
  })

  it("gives LOCAZ both of its addresses by default", () => {
    expect(getPartnerPlatform("locaz").allowedOrigins).toEqual(["https://www.locaz.co", "https://locaz.co"])
  })
})
