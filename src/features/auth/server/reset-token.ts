import { createHash } from "node:crypto"

/**
 * Password reset tokens are stored as their SHA-256 (security review, 22 Nov 2026): the e-mailed link carries the token,
 * the database only its hash, so reading the database is not enough to reset a password.
 */
export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}
