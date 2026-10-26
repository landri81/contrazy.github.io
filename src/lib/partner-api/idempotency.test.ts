import { describe, expect, it } from "vitest"

import { canonicalJson, hashIdempotentRequest, isValidIdempotencyKey } from "@/lib/partner-api/idempotency"

const PATH = "/api/partner/v1/bookings"

describe("isValidIdempotencyKey", () => {
  it("accepts 1-255 printable ASCII characters", () => {
    expect(isValidIdempotencyKey("booking-LZ-0001")).toBe(true)
    expect(isValidIdempotencyKey("a".repeat(255))).toBe(true)
  })

  it("refuses missing, empty, too long, spaced or non-ASCII keys", () => {
    expect(isValidIdempotencyKey(null)).toBe(false)
    expect(isValidIdempotencyKey(undefined)).toBe(false)
    expect(isValidIdempotencyKey("")).toBe(false)
    expect(isValidIdempotencyKey("a".repeat(256))).toBe(false)
    expect(isValidIdempotencyKey("two words")).toBe(false)
    expect(isValidIdempotencyKey("clé")).toBe(false)
  })
})

describe("canonicalJson", () => {
  it("sorts object keys at every depth and drops undefined values", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[2,{"y":2,"z":1}]},"b":1}')
  })

  it("keeps array order, which is meaningful", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
  })
})

describe("hashIdempotentRequest", () => {
  const body = { externalRef: "LZ-1", amount: 15000, customer: { firstName: "Alice", email: "alice@locaz.test" } }

  it("is a stable SHA-256 hex digest", () => {
    const hash = hashIdempotentRequest({ method: "POST", path: PATH, body })

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashIdempotentRequest({ method: "POST", path: PATH, body })).toBe(hash)
  })

  it("ignores key order and method case", () => {
    const reordered = { customer: { email: "alice@locaz.test", firstName: "Alice" }, amount: 15000, externalRef: "LZ-1" }

    expect(hashIdempotentRequest({ method: "post", path: PATH, body: reordered })).toBe(
      hashIdempotentRequest({ method: "POST", path: PATH, body })
    )
  })

  it("changes when the body, path or method changes", () => {
    const base = hashIdempotentRequest({ method: "POST", path: PATH, body })

    expect(hashIdempotentRequest({ method: "POST", path: PATH, body: { ...body, amount: 15001 } })).not.toBe(base)
    expect(hashIdempotentRequest({ method: "POST", path: `${PATH}/x`, body })).not.toBe(base)
    expect(hashIdempotentRequest({ method: "PATCH", path: PATH, body })).not.toBe(base)
  })
})
