import { describe, expect, it } from "vitest"

import { createPartnerApiKeySchema } from "@/features/partner-api/schemas/api-key.schema"
import {
  generateBase62,
  generatePartnerApiKey,
  getPartnerApiKeyPrefix,
  getSafePartnerApiKeyPrefix,
  hashPartnerApiKey,
  hasPartnerApiScope,
  isPartnerApiScope,
  parsePartnerApiKey,
  partnerApiKeyHashesMatch,
} from "@/lib/partner-api/keys"

const BASE62 = /^[0-9A-Za-z]+$/

describe("generatePartnerApiKey", () => {
  it("produces cz_test_/cz_live_ keys with 32 base62 characters", () => {
    const test = generatePartnerApiKey("TEST")
    const live = generatePartnerApiKey("LIVE")

    expect(test.key).toMatch(/^cz_test_[0-9A-Za-z]{32}$/)
    expect(live.key).toMatch(/^cz_live_[0-9A-Za-z]{32}$/)
    expect(test.mode).toBe("TEST")
    expect(live.mode).toBe("LIVE")
  })

  it("returns the SHA-256 hash and display prefix, never a second copy of the key", () => {
    const generated = generatePartnerApiKey("TEST")

    expect(generated.hashedKey).toBe(hashPartnerApiKey(generated.key))
    expect(generated.prefix).toBe(generated.key.slice(0, 16))
    expect(generated.key.startsWith(generated.prefix)).toBe(true)
    expect(Object.values(generated).filter((value) => value === generated.key)).toHaveLength(1)
  })

  it("does not repeat keys across many generations", () => {
    const keys = new Set(Array.from({ length: 2000 }, () => generatePartnerApiKey("TEST").key))
    expect(keys.size).toBe(2000)
  })

  it("draws base62 characters roughly uniformly (no modulo bias)", () => {
    const sample = generateBase62(62 * 1000)
    const counts = new Map<string, number>()

    for (const char of sample) {
      counts.set(char, (counts.get(char) ?? 0) + 1)
    }

    expect(sample).toMatch(BASE62)
    expect(counts.size).toBe(62)

    // Chi-square with 61 degrees of freedom; 120 is far beyond the 99.999th percentile.
    const expected = 1000
    const chiSquare = [...counts.values()].reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0)
    expect(chiSquare).toBeLessThan(120)
  })
})

describe("hashing", () => {
  it("uses hex SHA-256", () => {
    expect(hashPartnerApiKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })

  it("compares hashes in constant time and rejects malformed digests", () => {
    const hash = hashPartnerApiKey("cz_test_example")

    expect(partnerApiKeyHashesMatch(hash, hash)).toBe(true)
    expect(partnerApiKeyHashesMatch(hash, hashPartnerApiKey("cz_test_other"))).toBe(false)
    expect(partnerApiKeyHashesMatch(hash, "abcd")).toBe(false)
    expect(partnerApiKeyHashesMatch("", "")).toBe(false)
  })
})

describe("parsing and prefixes", () => {
  it("parses well-formed keys only", () => {
    const { key } = generatePartnerApiKey("LIVE")

    expect(parsePartnerApiKey(key)).toEqual({ mode: "LIVE", prefix: getPartnerApiKeyPrefix(key) })
    expect(parsePartnerApiKey(`${key}x`)).toBeNull()
    expect(parsePartnerApiKey("sk_test_123")).toBeNull()
    expect(parsePartnerApiKey("cz_test_short")).toBeNull()
  })

  it("only echoes a prefix for values shaped like Contrazy keys", () => {
    expect(getSafePartnerApiKeyPrefix("cz_test_AbCdEfGh-garbage")).toBe("cz_test_AbCdEfGh")
    expect(getSafePartnerApiKeyPrefix("sk_live_supersecretvalue")).toBeNull()
    expect(getSafePartnerApiKeyPrefix(null)).toBeNull()
  })
})

describe("scopes", () => {
  it("checks granted scopes exactly", () => {
    expect(hasPartnerApiScope(["bookings:read"], "bookings:read")).toBe(true)
    expect(hasPartnerApiScope(["bookings:read"], "bookings:write")).toBe(false)
    expect(hasPartnerApiScope([], "charges:write")).toBe(false)
    expect(isPartnerApiScope("bookings:read")).toBe(true)
    expect(isPartnerApiScope("admin")).toBe(false)
  })

  it("validates creation input and normalises scope order", () => {
    const parsed = createPartnerApiKeySchema.safeParse({
      name: "  LOCAZ staging ",
      scopes: ["charges:write", "bookings:read", "bookings:read"],
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ name: "LOCAZ staging", scopes: ["bookings:read", "charges:write"] })
    expect(createPartnerApiKeySchema.safeParse({ name: "x", scopes: [] }).success).toBe(false)
    expect(createPartnerApiKeySchema.safeParse({ name: "x", scopes: ["admin"] }).success).toBe(false)
    expect(createPartnerApiKeySchema.safeParse({ name: "   ", scopes: ["bookings:read"] }).success).toBe(false)
  })
})
