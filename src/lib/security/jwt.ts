import { SignJWT, jwtVerify } from "jose"

import { env } from "@/lib/env"

const secretKey = new TextEncoder().encode(env.JWT_ENCRYPTION_SECRET)

export type SecureTokenPayload = {
  sub: string
  role?: string
  transactionId?: string
  permissions?: string[]
}

export async function signSecureToken(payload: SecureTokenPayload, expiresIn: string = "15m") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey)
}

export async function verifySecureToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey)
  return payload as SecureTokenPayload
}
