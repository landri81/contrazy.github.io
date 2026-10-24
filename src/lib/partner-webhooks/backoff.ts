const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/**
 * Wait before each retry after a failed attempt: 1 m, 5 m, 30 m, 2 h, 6 h, 24 h.
 * The first attempt is immediate, so a delivery gets at most 7 attempts
 * (about 32.6 h in total) before it is marked DEAD.
 */
export const PARTNER_WEBHOOK_RETRY_DELAYS_MS = [
  MINUTE_MS,
  5 * MINUTE_MS,
  30 * MINUTE_MS,
  2 * HOUR_MS,
  6 * HOUR_MS,
  24 * HOUR_MS,
] as const

export const PARTNER_WEBHOOK_MAX_ATTEMPTS = PARTNER_WEBHOOK_RETRY_DELAYS_MS.length + 1

/** Request timeout for one delivery attempt. */
export const PARTNER_WEBHOOK_TIMEOUT_MS = 10_000

/**
 * When to try again after attempt number `attemptsMade` (1-based) failed.
 * Returns null when no retry is left: the delivery becomes DEAD.
 */
export function getPartnerWebhookRetryAt(attemptsMade: number, failedAt: Date): Date | null {
  if (!Number.isInteger(attemptsMade) || attemptsMade < 1) {
    throw new RangeError("attemptsMade must be a positive integer")
  }

  const delay = PARTNER_WEBHOOK_RETRY_DELAYS_MS[attemptsMade - 1]
  return delay === undefined ? null : new Date(failedAt.getTime() + delay)
}

/** 2xx is success; anything else (3xx included, redirects are not followed) is a failure. */
export function isSuccessfulWebhookStatus(status: number) {
  return status >= 200 && status < 300
}
