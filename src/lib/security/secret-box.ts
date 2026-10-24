import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"

/**
 * Symmetric encryption for secrets that must be read back (for example a
 * webhook signing secret). AES-256-GCM with a random 96-bit IV; the key is
 * derived with HKDF-SHA256 from the deployment's `JWT_ENCRYPTION_SECRET`,
 * using a per-purpose `info` label so each use gets its own key.
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>` (base64url parts).
 */
const VERSION = "v1"
const IV_BYTES = 12

function deriveKey(keyMaterial: string, purpose: string) {
  if (!keyMaterial || keyMaterial.length < 32) {
    throw new Error("Secret box key material must be at least 32 characters.")
  }

  return Buffer.from(hkdfSync("sha256", keyMaterial, "contrazy.secret-box", `contrazy:${purpose}:${VERSION}`, 32))
}

export function sealSecret(plaintext: string, keyMaterial: string, purpose: string) {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(keyMaterial, purpose), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

/** Throws when the value was tampered with, sealed for another purpose or with another key. */
export function openSecret(sealed: string, keyMaterial: string, purpose: string) {
  const [version, iv, tag, ciphertext, ...rest] = sealed.split(".")

  if (version !== VERSION || !iv || !tag || ciphertext === undefined || rest.length > 0) {
    throw new Error("Unsupported sealed secret format.")
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveKey(keyMaterial, purpose), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))

  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")
}
