import { createHmac } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  computeContrazySignature,
  DEFAULT_SIGNATURE_TOLERANCE_SECONDS,
  parseContrazySignatureHeader,
  signContrazyPayload,
  verifyContrazySignature,
} from "@/lib/partner-webhooks/signature"

const SECRET = "whsec_test_4f1c2a9b8e7d6c5b4a3f2e1d0c9b8a7f"
const BODY = JSON.stringify({ id: "evt_123", type: "booking.created", data: { booking: { id: "txn_1" } } })
const NOW_SECONDS = 1_793_500_000

describe("Contrazy-Signature", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW_SECONDS * 1000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("signs as t=<unix>,v1=<hex HMAC-SHA256(secret, t + '.' + rawBody)>", () => {
    const header = signContrazyPayload(BODY, SECRET)
    const expected = createHmac("sha256", SECRET).update(`${NOW_SECONDS}.${BODY}`).digest("hex")

    expect(header).toBe(`t=${NOW_SECONDS},v1=${expected}`)
    expect(computeContrazySignature(Buffer.from(BODY), SECRET, NOW_SECONDS)).toBe(expected)
  })

  it("verifies a valid signature, from a string or the raw bytes", () => {
    const header = signContrazyPayload(BODY, SECRET)

    expect(verifyContrazySignature(BODY, header, SECRET)).toBe(true)
    expect(verifyContrazySignature(new TextEncoder().encode(BODY), header, SECRET)).toBe(true)
  })

  it("accepts any matching v1 entry (secret rotation) and ignores unknown schemes", () => {
    const good = computeContrazySignature(BODY, SECRET, NOW_SECONDS)
    const other = computeContrazySignature(BODY, "whsec_old_secret", NOW_SECONDS)
    const header = `t=${NOW_SECONDS},v0=deadbeef,v1=${other},v1=${good}`

    expect(verifyContrazySignature(BODY, header, SECRET)).toBe(true)
  })

  it("accepts a timestamp exactly at the tolerance and rejects one second beyond, in both directions", () => {
    const tolerance = DEFAULT_SIGNATURE_TOLERANCE_SECONDS

    expect(verifyContrazySignature(BODY, signContrazyPayload(BODY, SECRET, NOW_SECONDS - tolerance), SECRET)).toBe(true)
    expect(verifyContrazySignature(BODY, signContrazyPayload(BODY, SECRET, NOW_SECONDS - tolerance - 1), SECRET)).toBe(false)
    expect(verifyContrazySignature(BODY, signContrazyPayload(BODY, SECRET, NOW_SECONDS + tolerance), SECRET)).toBe(true)
    expect(verifyContrazySignature(BODY, signContrazyPayload(BODY, SECRET, NOW_SECONDS + tolerance + 1), SECRET)).toBe(false)
  })

  it("rejects an expired signature and honours a custom tolerance", () => {
    const header = signContrazyPayload(BODY, SECRET, NOW_SECONDS - 600)

    expect(verifyContrazySignature(BODY, header, SECRET)).toBe(false)
    expect(verifyContrazySignature(BODY, header, SECRET, 900)).toBe(true)
    expect(verifyContrazySignature(BODY, header, SECRET, 60)).toBe(false)
  })

  it("never disables the timestamp check: a non-positive or invalid tolerance throws", () => {
    const header = signContrazyPayload(BODY, SECRET, NOW_SECONDS - 86_400)

    for (const tolerance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => verifyContrazySignature(BODY, header, SECRET, tolerance)).toThrow(RangeError)
    }
  })

  it("rejects a tampered body", () => {
    const header = signContrazyPayload(BODY, SECRET)
    const tampered = BODY.replace("booking.created", "booking.cancelled")

    expect(verifyContrazySignature(tampered, header, SECRET)).toBe(false)
    expect(verifyContrazySignature(`${BODY} `, header, SECRET)).toBe(false)
  })

  it("rejects a tampered timestamp (the signature covers t)", () => {
    const signature = computeContrazySignature(BODY, SECRET, NOW_SECONDS - 10)

    expect(verifyContrazySignature(BODY, `t=${NOW_SECONDS},v1=${signature}`, SECRET)).toBe(false)
  })

  it("rejects the wrong secret and an empty secret", () => {
    const header = signContrazyPayload(BODY, SECRET)

    expect(verifyContrazySignature(BODY, header, "whsec_some_other_secret")).toBe(false)
    expect(verifyContrazySignature(BODY, header, "")).toBe(false)
  })

  it.each([
    ["missing", undefined],
    ["null", null],
    ["empty", ""],
    ["no timestamp", `v1=${"a".repeat(64)}`],
    ["no signature", `t=${NOW_SECONDS}`],
    ["only unknown schemes", `t=${NOW_SECONDS},v0=${"a".repeat(64)}`],
    ["non-numeric timestamp", `t=abc,v1=${"a".repeat(64)}`],
    ["duplicate timestamp", `t=${NOW_SECONDS},t=${NOW_SECONDS},v1=${"a".repeat(64)}`],
    ["short signature", `t=${NOW_SECONDS},v1=abc123`],
    ["non-hex signature", `t=${NOW_SECONDS},v1=${"z".repeat(64)}`],
    ["part without =", `t=${NOW_SECONDS},v1`],
    ["oversized", `t=${NOW_SECONDS},${"v1=".padEnd(2100, "a")}`],
  ])("rejects a malformed header (%s)", (_label, header) => {
    expect(parseContrazySignatureHeader(header)).toBeNull()
    expect(verifyContrazySignature(BODY, header, SECRET)).toBe(false)
  })

  it("parses a well-formed header, trimming spaces and lower-casing hex", () => {
    const signature = "A".repeat(64)

    expect(parseContrazySignatureHeader(` t=${NOW_SECONDS} , v1=${signature} `)).toEqual({
      timestamp: NOW_SECONDS,
      signatures: ["a".repeat(64)],
    })
  })
})
