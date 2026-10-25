import { timingSafeEqual } from "node:crypto"

import { env } from "@/lib/env"

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; compared in constant time. No secret set = refused. */
export function isCronAuthorized(request: Request) {
  const secret = env.CRON_SECRET

  if (!secret) {
    return false
  }

  const presented = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)

  return presented.length === expected.length && timingSafeEqual(presented, expected)
}
