import { randomBytes } from "node:crypto"

import { openSecret, sealSecret } from "@/lib/security/secret-box"

export const PARTNER_WEBHOOK_SECRET_PREFIX = "whsec_"
const SECRET_PURPOSE = "partner-webhook-secret"
/** Characters of the secret kept in clear for display (`whsec_` + 4). */
const DISPLAY_PREFIX_LENGTH = PARTNER_WEBHOOK_SECRET_PREFIX.length + 4

/** `whsec_` + 32 random bytes (base64url, 43 chars). */
export function generatePartnerWebhookSecret() {
  return `${PARTNER_WEBHOOK_SECRET_PREFIX}${randomBytes(32).toString("base64url")}`
}

export function getPartnerWebhookSecretDisplayPrefix(secret: string) {
  return secret.slice(0, DISPLAY_PREFIX_LENGTH)
}

export function encryptPartnerWebhookSecret(secret: string, keyMaterial: string) {
  return sealSecret(secret, keyMaterial, SECRET_PURPOSE)
}

export function decryptPartnerWebhookSecret(encryptedSecret: string, keyMaterial: string) {
  return openSecret(encryptedSecret, keyMaterial, SECRET_PURPOSE)
}
