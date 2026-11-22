import { createHash } from "node:crypto"

import { FixedWindowRateLimiter } from "@/lib/partner-api/rate-limit"

/**
 * Throttles for the public account forms (security review, 22 Nov 2026): sign-in, registration, password reset and the
 * contact form, per e-mail and per IP. Counted in the server instance's memory, like the partner API's limiter: each
 * instance enforces its own budget, which stops scripted guessing and inbox flooding from one source; a shared store
 * can replace it behind the same calls.
 */

const MINUTE = 60_000

const LIMITERS = {
  signInEmail: new FixedWindowRateLimiter(10, 15 * MINUTE),
  signInIp: new FixedWindowRateLimiter(30, 15 * MINUTE),
  registerIp: new FixedWindowRateLimiter(5, 60 * MINUTE),
  resetEmail: new FixedWindowRateLimiter(3, 60 * MINUTE),
  resetIp: new FixedWindowRateLimiter(10, 60 * MINUTE),
  contactIp: new FixedWindowRateLimiter(5, 60 * MINUTE),
} as const

export type AuthThrottle = "signIn" | "register" | "reset" | "contact"

/** The client's IP from the proxy headers (Vercel sets x-forwarded-for; the first entry is the client). */
export function requestIp(headers: Headers | Record<string, unknown> | undefined): string | null {
  const read = (name: string) => {
    if (!headers) return null
    if (headers instanceof Headers) return headers.get(name)
    const value = headers[name]
    return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : null
  }
  return read("x-forwarded-for")?.split(",")[0]?.trim() || read("x-real-ip")?.trim() || null
}

// E-mails are kept hashed in memory.
const emailKey = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex")

/** Counts one attempt; false when the e-mail or the IP has used its budget for the window. */
export function allowAttempt(kind: AuthThrottle, { ip, email }: { ip?: string | null; email?: string | null }) {
  const checks: [FixedWindowRateLimiter, string][] = []
  if (kind === "signIn") {
    if (email) checks.push([LIMITERS.signInEmail, emailKey(email)])
    if (ip) checks.push([LIMITERS.signInIp, ip])
  } else if (kind === "register") {
    if (ip) checks.push([LIMITERS.registerIp, ip])
  } else if (kind === "reset") {
    if (email) checks.push([LIMITERS.resetEmail, emailKey(email)])
    if (ip) checks.push([LIMITERS.resetIp, ip])
  } else if (ip) {
    checks.push([LIMITERS.contactIp, ip])
  }
  // Every counter is charged, so a source can't spread its attempts across keys to dodge one of them.
  return checks.map(([limiter, key]) => limiter.consume(key).allowed).every(Boolean)
}

/** For tests: forget every count. */
export function resetAuthRateLimits() {
  for (const limiter of Object.values(LIMITERS)) limiter.reset()
}
