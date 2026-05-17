import { createHmac, timingSafeEqual } from "crypto"

import { env } from "@/lib/env"

function buildExpectedToken(paymentId: string) {
  return createHmac("sha256", env.NEXTAUTH_SECRET)
    .update(`fee-invoice-render:${paymentId}`)
    .digest("hex")
}

export function createFeeInvoiceRenderToken(paymentId: string) {
  return buildExpectedToken(paymentId)
}

export function verifyFeeInvoiceRenderToken(
  paymentId: string,
  token: string | null | undefined
) {
  if (!token) return false

  const expected = buildExpectedToken(paymentId)

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}
