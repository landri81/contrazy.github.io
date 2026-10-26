import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export {
  hasPartnerApiScope,
  isPartnerApiScope,
  normalizePartnerApiScopes,
  PARTNER_API_SCOPES,
  type PartnerApiScope,
} from "@/lib/partner-api/scopes"

export const PARTNER_API_KEY_MODES = ["TEST", "LIVE"] as const
export type PartnerApiKeyModeValue = (typeof PARTNER_API_KEY_MODES)[number]

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
// Largest multiple of 62 that fits in a byte; bytes at or above it are rejected
// so every base62 character is equally likely (no modulo bias).
const BASE62_REJECTION_LIMIT = 248

export const PARTNER_API_KEY_SECRET_LENGTH = 32
/** Characters of the secret part kept (with the mode tag) as the visible prefix. */
export const PARTNER_API_KEY_PREFIX_SECRET_CHARS = 8

const MODE_TAGS: Record<PartnerApiKeyModeValue, string> = {
  TEST: "cz_test_",
  LIVE: "cz_live_",
}

const PARTNER_API_KEY_PATTERN = /^cz_(test|live)_([0-9A-Za-z]{32})$/

export function generateBase62(length: number) {
  let result = ""

  while (result.length < length) {
    const bytes = randomBytes((length - result.length) * 2)

    for (const byte of bytes) {
      if (byte >= BASE62_REJECTION_LIMIT) {
        continue
      }

      result += BASE62_ALPHABET[byte % 62]

      if (result.length === length) {
        break
      }
    }
  }

  return result
}

export function hashPartnerApiKey(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex")
}

/** Constant-time comparison of two hex SHA-256 digests. */
export function partnerApiKeyHashesMatch(expectedHex: string, actualHex: string) {
  const expected = Buffer.from(expectedHex, "hex")
  const actual = Buffer.from(actualHex, "hex")

  if (expected.length !== 32 || actual.length !== 32) {
    return false
  }

  return timingSafeEqual(expected, actual)
}

export function parsePartnerApiKey(key: string) {
  const match = PARTNER_API_KEY_PATTERN.exec(key)

  if (!match) {
    return null
  }

  return {
    mode: (match[1] === "live" ? "LIVE" : "TEST") as PartnerApiKeyModeValue,
    prefix: getPartnerApiKeyPrefix(key),
  }
}

/**
 * Display prefix: the mode tag plus the first 8 characters of the secret
 * (e.g. `cz_test_AbC123xY`). Safe to show and log; the remaining 24 base62
 * characters (~142 bits) stay secret.
 */
export function getPartnerApiKeyPrefix(key: string) {
  return key.slice(0, MODE_TAGS.TEST.length + PARTNER_API_KEY_PREFIX_SECRET_CHARS)
}

/**
 * Best-effort prefix for audit rows when a presented key may be malformed.
 * Returns null unless the value looks like a Contrazy key, so random secrets
 * pasted by mistake are never echoed into logs.
 */
export function getSafePartnerApiKeyPrefix(value: string | null | undefined) {
  if (!value || !/^cz_(test|live)_[0-9A-Za-z]{8}/.test(value)) {
    return null
  }

  return getPartnerApiKeyPrefix(value)
}

export function generatePartnerApiKey(mode: PartnerApiKeyModeValue) {
  const key = `${MODE_TAGS[mode]}${generateBase62(PARTNER_API_KEY_SECRET_LENGTH)}`

  return {
    key,
    prefix: getPartnerApiKeyPrefix(key),
    hashedKey: hashPartnerApiKey(key),
    mode,
  }
}
