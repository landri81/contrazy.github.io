import { beforeEach, describe, expect, it } from "vitest"

import { allowAttempt, requestIp, resetAuthRateLimits } from "./auth-rate-limit"

/** Security review, 22 Nov 2026: throttles for sign-in, registration, password reset and the contact form. */

beforeEach(() => resetAuthRateLimits())

const tries = (count: number, attempt: () => boolean) => Array.from({ length: count }, attempt)

describe("allowAttempt", () => {
  it("sign-in: 10 per e-mail (any case) and 30 per address in 15 minutes", () => {
    expect(tries(10, () => allowAttempt("signIn", { email: "Owner@Rentals.test", ip: `10.0.0.${Math.random()}` })).every(Boolean)).toBe(true)
    expect(allowAttempt("signIn", { email: "owner@rentals.test", ip: "10.0.0.99" })).toBe(false)
    // Another e-mail is not affected.
    expect(allowAttempt("signIn", { email: "other@rentals.test", ip: "10.0.0.99" })).toBe(true)

    resetAuthRateLimits()
    expect(tries(30, () => allowAttempt("signIn", { email: `user${Math.random()}@rentals.test`, ip: "203.0.113.7" })).every(Boolean)).toBe(true)
    expect(allowAttempt("signIn", { email: "fresh@rentals.test", ip: "203.0.113.7" })).toBe(false)
  })

  it("register: 5 an hour per address; reset: 3 per e-mail; contact: 5 per address", () => {
    expect(tries(5, () => allowAttempt("register", { ip: "203.0.113.8" })).every(Boolean)).toBe(true)
    expect(allowAttempt("register", { ip: "203.0.113.8" })).toBe(false)
    expect(allowAttempt("register", { ip: "203.0.113.9" })).toBe(true)

    expect(tries(3, () => allowAttempt("reset", { email: "a@rentals.test", ip: `198.51.100.${Math.random()}` })).every(Boolean)).toBe(true)
    expect(allowAttempt("reset", { email: "a@rentals.test", ip: "198.51.100.200" })).toBe(false)

    expect(tries(5, () => allowAttempt("contact", { ip: "192.0.2.1" })).every(Boolean)).toBe(true)
    expect(allowAttempt("contact", { ip: "192.0.2.1" })).toBe(false)
  })

  it("lets a request without an address or e-mail through (nothing to count it by)", () => {
    expect(tries(20, () => allowAttempt("contact", {})).every(Boolean)).toBe(true)
  })
})

describe("requestIp", () => {
  it("reads the first forwarded address, from Headers or a plain object", () => {
    expect(requestIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7")
    expect(requestIp({ "x-real-ip": "203.0.113.8" })).toBe("203.0.113.8")
    expect(requestIp(undefined)).toBeNull()
  })
})
