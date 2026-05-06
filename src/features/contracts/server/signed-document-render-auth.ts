import { createHmac, timingSafeEqual } from "crypto"

import { env } from "@/lib/env"

function buildExpectedToken(transactionId: string) {
  return createHmac("sha256", env.NEXTAUTH_SECRET)
    .update(`signed-document-render:${transactionId}`)
    .digest("hex")
}

export function createSignedDocumentRenderToken(transactionId: string) {
  return buildExpectedToken(transactionId)
}

export function verifySignedDocumentRenderToken(transactionId: string, token: string | null | undefined) {
  if (!token) {
    return false
  }

  const expected = buildExpectedToken(transactionId)

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}
