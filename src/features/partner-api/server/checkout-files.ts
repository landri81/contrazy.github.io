import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * The `fileId` of the embedded checkout's documents step (M10): a stored file's reference, signed so the partner can
 * hand it back with the step but cannot forge one, valid for its booking, requirement and slot only, for 24 hours.
 */

export type CheckoutFile = { bookingId: string; requirementId: string; slotIndex: number; publicId: string; secureUrl: string; fileName: string | null }

const LIFETIME_MS = 24 * 3_600_000
const PREFIX = "cf_"

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`checkout-file:${payload}`).digest("base64url")
}

export function signCheckoutFile(file: CheckoutFile, secret: string, now = new Date()) {
  const payload = Buffer.from(JSON.stringify({ ...file, exp: now.getTime() + LIFETIME_MS })).toString("base64url")
  return `${PREFIX}${payload}.${signature(payload, secret)}`
}

/** The file behind a fileId, or null when it was altered, expired, or belongs to another booking. */
export function verifyCheckoutFile(fileId: string, bookingId: string, secret: string, now = new Date()): CheckoutFile | null {
  if (!fileId.startsWith(PREFIX)) return null
  const [payload, given] = fileId.slice(PREFIX.length).split(".")
  if (!payload || !given) return null
  const expected = signature(payload, secret)
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null
  try {
    const file = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CheckoutFile & { exp: number }
    if (file.bookingId !== bookingId || typeof file.exp !== "number" || file.exp <= now.getTime()) return null
    return { bookingId: file.bookingId, requirementId: file.requirementId, slotIndex: file.slotIndex, publicId: file.publicId, secureUrl: file.secureUrl, fileName: file.fileName }
  } catch {
    return null
  }
}
