import { createHash } from "node:crypto"

export const IDEMPOTENCY_KEY_HEADER = "idempotency-key"
export const IDEMPOTENCY_REPLAYED_HEADER = "Idempotent-Replayed"
export const IDEMPOTENCY_KEY_MAX_LENGTH = 255
/** A reservation older than this without a stored response is treated as abandoned. */
export const IDEMPOTENCY_STALE_RESERVATION_MS = 5 * 60_000

const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7E]+$/

export function isValidIdempotencyKey(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= IDEMPOTENCY_KEY_MAX_LENGTH &&
    IDEMPOTENCY_KEY_PATTERN.test(value)
  )
}

/** JSON with object keys sorted at every depth, so key order never changes the hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null"
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`
}

/** SHA-256 over method, path and the canonical body: same key + same request => same hash. */
export function hashIdempotentRequest(input: { method: string; path: string; body: unknown }) {
  return createHash("sha256")
    .update(`${input.method.toUpperCase()}\n${input.path}\n${canonicalJson(input.body)}`)
    .digest("hex")
}
