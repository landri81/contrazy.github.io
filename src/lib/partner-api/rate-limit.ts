export type RateLimitResult =
  | { allowed: true; limit: number; remaining: number; resetAt: number }
  | { allowed: false; limit: number; remaining: 0; resetAt: number; retryAfterSeconds: number }

type Window = { startedAt: number; count: number }

/**
 * Fixed-window in-memory rate limiter keyed by an identifier (the API key id).
 *
 * State lives in the current server instance only, so on a multi-instance
 * deployment each instance enforces its own budget. That is enough to stop a
 * runaway client; a shared store can replace it behind the same interface.
 */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>()
  private lastSweepAt = 0

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now
  ) {}

  consume(id: string): RateLimitResult {
    const now = this.now()
    this.sweep(now)

    let window = this.windows.get(id)

    if (!window || now - window.startedAt >= this.windowMs) {
      window = { startedAt: now, count: 0 }
      this.windows.set(id, window)
    }

    const resetAt = window.startedAt + this.windowMs

    if (window.count >= this.limit) {
      return {
        allowed: false,
        limit: this.limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      }
    }

    window.count += 1

    return {
      allowed: true,
      limit: this.limit,
      remaining: this.limit - window.count,
      resetAt,
    }
  }

  reset() {
    this.windows.clear()
    this.lastSweepAt = 0
  }

  private sweep(now: number) {
    if (now - this.lastSweepAt < this.windowMs) {
      return
    }

    this.lastSweepAt = now

    for (const [id, window] of this.windows) {
      if (now - window.startedAt >= this.windowMs) {
        this.windows.delete(id)
      }
    }
  }
}

export const PARTNER_API_RATE_LIMIT_PER_MINUTE = 120

export const partnerApiRateLimiter = new FixedWindowRateLimiter(PARTNER_API_RATE_LIMIT_PER_MINUTE, 60_000)
