import { describe, expect, it } from "vitest"

import { FixedWindowRateLimiter, PARTNER_API_RATE_LIMIT_PER_MINUTE } from "@/lib/partner-api/rate-limit"

function createClock(start = 1_000_000) {
  let now = start
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms
    },
  }
}

describe("FixedWindowRateLimiter", () => {
  it("allows up to the limit per window, then refuses with a retry delay", () => {
    const clock = createClock()
    const limiter = new FixedWindowRateLimiter(3, 60_000, clock.now)

    expect(limiter.consume("key").allowed).toBe(true)
    expect(limiter.consume("key").allowed).toBe(true)
    const third = limiter.consume("key")
    expect(third).toMatchObject({ allowed: true, remaining: 0 })

    clock.advance(15_500)
    const refused = limiter.consume("key")
    expect(refused).toMatchObject({ allowed: false, remaining: 0, retryAfterSeconds: 45 })
  })

  it("starts a fresh window once the previous one has elapsed", () => {
    const clock = createClock()
    const limiter = new FixedWindowRateLimiter(1, 60_000, clock.now)

    expect(limiter.consume("key").allowed).toBe(true)
    expect(limiter.consume("key").allowed).toBe(false)

    clock.advance(60_000)
    expect(limiter.consume("key").allowed).toBe(true)
  })

  it("tracks each key independently", () => {
    const clock = createClock()
    const limiter = new FixedWindowRateLimiter(1, 60_000, clock.now)

    expect(limiter.consume("a").allowed).toBe(true)
    expect(limiter.consume("a").allowed).toBe(false)
    expect(limiter.consume("b").allowed).toBe(true)
  })

  it("never reports a retry delay below one second", () => {
    const clock = createClock()
    const limiter = new FixedWindowRateLimiter(1, 60_000, clock.now)

    limiter.consume("key")
    clock.advance(59_999)
    const refused = limiter.consume("key")
    expect(refused.allowed).toBe(false)
    expect(refused.allowed === false && refused.retryAfterSeconds).toBe(1)
  })

  it("uses 120 requests per minute for partner keys", () => {
    expect(PARTNER_API_RATE_LIMIT_PER_MINUTE).toBe(120)
  })
})
