import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * `Contrazy-Signature` webhook signing, modelled on Stripe's scheme:
 *
 *   Contrazy-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>
 *
 * Receivers verify with `verifyContrazySignature` on the raw request body
 * (the exact bytes, before any JSON parsing). Several `v1=` entries may be
 * present; any one matching is enough.
 */
export const CONTRAZY_SIGNATURE_HEADER = "Contrazy-Signature"
export const CONTRAZY_SIGNATURE_SCHEME = "v1"
export const DEFAULT_SIGNATURE_TOLERANCE_SECONDS = 300

type RawBody = string | Uint8Array

function toBuffer(rawBody: RawBody) {
  return typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody)
}

export function computeContrazySignature(rawBody: RawBody, secret: string, timestamp: number) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.`, "utf8")
    .update(toBuffer(rawBody))
    .digest("hex")
}

/** Builds the header value for a body; `timestamp` defaults to now (unix seconds). */
export function signContrazyPayload(rawBody: RawBody, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},${CONTRAZY_SIGNATURE_SCHEME}=${computeContrazySignature(rawBody, secret, timestamp)}`
}

export type ParsedContrazySignature = {
  timestamp: number
  signatures: string[]
}

/** Parses `t=…,v1=…[,v1=…]`; returns null when the header is malformed. */
export function parseContrazySignatureHeader(header: string | null | undefined): ParsedContrazySignature | null {
  if (!header || header.length > 2048) {
    return null
  }

  let timestamp: number | null = null
  const signatures: string[] = []

  for (const part of header.split(",")) {
    const separator = part.indexOf("=")

    if (separator <= 0) {
      return null
    }

    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()

    if (key === "t") {
      if (!/^\d{1,12}$/.test(value) || timestamp !== null) {
        return null
      }

      timestamp = Number(value)
    } else if (key === CONTRAZY_SIGNATURE_SCHEME) {
      if (!/^[0-9a-f]{64}$/i.test(value)) {
        return null
      }

      signatures.push(value.toLowerCase())
    }
    // Unknown schemes are ignored so new ones can be added without breaking receivers.
  }

  if (timestamp === null || signatures.length === 0) {
    return null
  }

  return { timestamp, signatures }
}

/**
 * Verifies a `Contrazy-Signature` header against the raw body and the
 * endpoint's `whsec_` secret. Returns false for a malformed header, a
 * timestamp outside `toleranceSec` (either direction), or no matching
 * signature. Comparison is constant-time.
 *
 * The timestamp check cannot be turned off: a `toleranceSec` that is not a
 * positive finite number throws a RangeError instead of accepting replays.
 */
export function verifyContrazySignature(
  rawBody: RawBody,
  header: string | null | undefined,
  secret: string,
  toleranceSec = DEFAULT_SIGNATURE_TOLERANCE_SECONDS
): boolean {
  if (typeof toleranceSec !== "number" || !Number.isFinite(toleranceSec) || toleranceSec <= 0) {
    throw new RangeError("toleranceSec must be a positive number of seconds")
  }

  if (!secret) {
    return false
  }

  const parsed = parseContrazySignatureHeader(header)

  if (!parsed) {
    return false
  }

  const nowSeconds = Math.floor(Date.now() / 1000)

  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSec) {
    return false
  }

  const expected = Buffer.from(computeContrazySignature(rawBody, secret, parsed.timestamp), "hex")

  return parsed.signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex")
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  })
}
