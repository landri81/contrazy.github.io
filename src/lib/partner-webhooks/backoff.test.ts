import { describe, expect, it } from "vitest"

import {
  getPartnerWebhookRetryAt,
  isSuccessfulWebhookStatus,
  PARTNER_WEBHOOK_MAX_ATTEMPTS,
  PARTNER_WEBHOOK_RETRY_DELAYS_MS,
  PARTNER_WEBHOOK_TIMEOUT_MS,
} from "@/lib/partner-webhooks/backoff"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const FAILED_AT = new Date("2026-11-02T10:00:00.000Z")

describe("partner webhook backoff", () => {
  it("waits 1 m, 5 m, 30 m, 2 h, 6 h, 24 h between attempts", () => {
    expect(PARTNER_WEBHOOK_RETRY_DELAYS_MS).toEqual([MINUTE, 5 * MINUTE, 30 * MINUTE, 2 * HOUR, 6 * HOUR, 24 * HOUR])
  })

  it.each([
    [1, MINUTE],
    [2, 5 * MINUTE],
    [3, 30 * MINUTE],
    [4, 2 * HOUR],
    [5, 6 * HOUR],
    [6, 24 * HOUR],
  ])("schedules the retry after failed attempt %i", (attemptsMade, delay) => {
    expect(getPartnerWebhookRetryAt(attemptsMade, FAILED_AT)?.getTime()).toBe(FAILED_AT.getTime() + delay)
  })

  it("gives up after the 7th attempt (first send + 6 retries): the delivery becomes DEAD", () => {
    expect(PARTNER_WEBHOOK_MAX_ATTEMPTS).toBe(7)
    expect(getPartnerWebhookRetryAt(7, FAILED_AT)).toBeNull()
    expect(getPartnerWebhookRetryAt(8, FAILED_AT)).toBeNull()
  })

  it("spreads the retries over about 32.6 hours in total", () => {
    const total = PARTNER_WEBHOOK_RETRY_DELAYS_MS.reduce((sum, delay) => sum + delay, 0)
    expect(total).toBe(32 * HOUR + 36 * MINUTE)
  })

  it.each([0, -1, 1.5, Number.NaN])("rejects an invalid attempt count (%s)", (attemptsMade) => {
    expect(() => getPartnerWebhookRetryAt(attemptsMade, FAILED_AT)).toThrow(RangeError)
  })

  it("treats 2xx as success and everything else, redirects included, as failure", () => {
    for (const status of [200, 201, 202, 204, 299]) {
      expect(isSuccessfulWebhookStatus(status)).toBe(true)
    }

    for (const status of [100, 199, 300, 301, 302, 304, 400, 401, 404, 410, 429, 500, 502, 503]) {
      expect(isSuccessfulWebhookStatus(status)).toBe(false)
    }
  })

  it("uses a 10 s request timeout", () => {
    expect(PARTNER_WEBHOOK_TIMEOUT_MS).toBe(10_000)
  })
})
