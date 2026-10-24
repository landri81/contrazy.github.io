import { isIP } from "node:net"

export const PARTNER_WEBHOOK_URL_MAX_LENGTH = 2048

export type WebhookUrlCheck =
  | { ok: true; url: string }
  | { ok: false; reason: "invalid_url" | "https_required" | "credentials_not_allowed" | "private_address" }

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "[::1]"
}

function isPrivateIpv4(address: string) {
  const [a, b] = address.split(".").map(Number)

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  )
}

function isPrivateIpv6(address: string) {
  const value = address.toLowerCase()

  if (value === "::" || value === "::1") {
    return true
  }

  if (value.startsWith("::ffff:")) {
    const mapped = value.slice(7)
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true
  }

  return /^f[cd]/.test(value) || /^fe[89ab]/.test(value) || value.startsWith("ff")
}

/** True for loopback, private, link-local, CGNAT and multicast IP literals. */
export function isPrivateAddressLiteral(hostname: string) {
  const host = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname
  const version = isIP(host)

  if (version === 4) {
    return isPrivateIpv4(host)
  }

  if (version === 6) {
    return isPrivateIpv6(host)
  }

  return false
}

/**
 * Webhook endpoint URLs must be `https://` on a public host. Outside
 * production (`allowLocalhost`), `http://localhost` / `127.0.0.1` are also
 * accepted so partners can test against a local receiver.
 */
export function checkPartnerWebhookUrl(value: string, options: { allowLocalhost: boolean }): WebhookUrlCheck {
  const trimmed = value.trim()

  if (!trimmed || trimmed.length > PARTNER_WEBHOOK_URL_MAX_LENGTH) {
    return { ok: false, reason: "invalid_url" }
  }

  let url: URL

  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, reason: "invalid_url" }
  }

  if (url.username || url.password) {
    return { ok: false, reason: "credentials_not_allowed" }
  }

  const hostname = url.hostname.toLowerCase()
  const local = isLocalHostname(hostname)

  if (url.protocol === "http:") {
    if (!(options.allowLocalhost && local)) {
      return { ok: false, reason: "https_required" }
    }
  } else if (url.protocol !== "https:") {
    return { ok: false, reason: "https_required" }
  }

  if (!hostname || (local && !options.allowLocalhost)) {
    return { ok: false, reason: local ? "private_address" : "invalid_url" }
  }

  if (!local && isPrivateAddressLiteral(hostname)) {
    return { ok: false, reason: "private_address" }
  }

  url.hash = ""
  return { ok: true, url: url.toString() }
}

/** Local receivers are allowed everywhere except production deployments. */
export function allowLocalWebhookUrls(nodeEnv: string | undefined) {
  return nodeEnv !== "production"
}
