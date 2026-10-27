import { describe, expect, it } from "vitest"

import { signCheckoutFile, verifyCheckoutFile } from "./checkout-files"

/** The documents step's fileId: the partner hands it back, cannot forge one, and it works for its own booking only. */

const SECRET = "s".repeat(40)
const NOW = new Date("2026-11-05T09:00:00Z")
const file = { bookingId: "tx_1", requirementId: "req_1", slotIndex: 1, publicId: "client-documents/tok/abc", secureUrl: "https://res.cloudinary.com/x/abc.jpg", fileName: "verso.jpg" }

describe("checkout fileId", () => {
  it("gives the stored file back for its booking", () => {
    const fileId = signCheckoutFile(file, SECRET, NOW)
    expect(fileId).toMatch(/^cf_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(verifyCheckoutFile(fileId, "tx_1", SECRET, NOW)).toEqual(file)
  })

  it("refuses another booking, an altered or foreign signature, and an expired id", () => {
    const fileId = signCheckoutFile(file, SECRET, NOW)
    expect(verifyCheckoutFile(fileId, "tx_2", SECRET, NOW)).toBeNull()
    expect(verifyCheckoutFile(signCheckoutFile(file, "other-secret-".repeat(4), NOW), "tx_1", SECRET, NOW)).toBeNull()

    const [payload, signature] = fileId.slice(3).split(".")
    const altered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), slotIndex: 0 })).toString("base64url")
    expect(verifyCheckoutFile(`cf_${altered}.${signature}`, "tx_1", SECRET, NOW)).toBeNull()

    expect(verifyCheckoutFile(fileId, "tx_1", SECRET, new Date(NOW.getTime() + 25 * 3_600_000))).toBeNull()
    expect(verifyCheckoutFile("not-a-file-id", "tx_1", SECRET, NOW)).toBeNull()
  })
})
