import type { PartnerApiKey, VendorProfile } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { PartnerApiError } from "@/lib/partner-api/errors"
import {
  getSafePartnerApiKeyPrefix,
  hashPartnerApiKey,
  hasPartnerApiScope,
  parsePartnerApiKey,
  partnerApiKeyHashesMatch,
  type PartnerApiScope,
} from "@/lib/partner-api/keys"
import { partnerApiRateLimiter } from "@/lib/partner-api/rate-limit"

export const PARTNER_API_REFUSED_ACTION = "partner_api.refused"
export const LAST_USED_UPDATE_INTERVAL_MS = 60_000

export type PartnerApiRefusalReason =
  | "missing_key"
  | "invalid_scheme"
  | "malformed_key"
  | "unknown_key"
  | "revoked_key"
  | "insufficient_scope"
  | "rate_limited"

export type PartnerApiAuthContext = {
  vendorProfile: VendorProfile
  apiKey: PartnerApiKey
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")

  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim()

    if (first) {
      return first
    }
  }

  return request.headers.get("x-real-ip")?.trim() || null
}

function readBearerToken(request: Request): { token: string } | { reason: "missing_key" | "invalid_scheme" } {
  const header = request.headers.get("authorization")?.trim()

  if (!header) {
    return { reason: "missing_key" }
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header)

  if (!match?.[1]) {
    return { reason: "invalid_scheme" }
  }

  return { token: match[1] }
}

async function recordRefusal(
  request: Request,
  input: {
    reason: PartnerApiRefusalReason
    keyPrefix: string | null
    apiKeyId?: string | null
    vendorId?: string | null
    scope: PartnerApiScope
    requestId?: string
  }
) {
  try {
    const url = new URL(request.url)

    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: PARTNER_API_REFUSED_ACTION,
        entityType: "PartnerApiKey",
        entityId: input.apiKeyId ?? null,
        metadata: {
          reason: input.reason,
          keyPrefix: input.keyPrefix,
          ip: getRequestIp(request),
          vendorId: input.vendorId ?? null,
          requiredScope: input.scope,
          method: request.method,
          path: url.pathname,
          requestId: input.requestId ?? null,
        },
      },
    })
  } catch (error) {
    console.error("Partner API refusal audit skipped", {
      reason: input.reason,
      keyPrefix: input.keyPrefix,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

async function touchLastUsedAt(apiKey: PartnerApiKey, now: Date) {
  if (apiKey.lastUsedAt && now.getTime() - apiKey.lastUsedAt.getTime() < LAST_USED_UPDATE_INTERVAL_MS) {
    return
  }

  try {
    // Conditional update so concurrent requests write at most once per interval.
    await prisma.partnerApiKey.updateMany({
      where: {
        id: apiKey.id,
        OR: [
          { lastUsedAt: null },
          { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_UPDATE_INTERVAL_MS) } },
        ],
      },
      data: { lastUsedAt: now },
    })
  } catch (error) {
    console.error("Partner API key lastUsedAt update skipped", {
      keyPrefix: apiKey.prefix,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

const INVALID_KEY_MESSAGE = "The API key is missing, invalid or revoked."

/**
 * Authenticates a partner API request with `Authorization: Bearer cz_…`.
 * Throws a `PartnerApiError` (401/403/429) on refusal, after writing a
 * `partner_api.refused` audit row. The raw key is never stored or logged.
 */
export async function requirePartnerApiKey(
  request: Request,
  scope: PartnerApiScope,
  options: { requestId?: string } = {}
): Promise<PartnerApiAuthContext> {
  const bearer = readBearerToken(request)

  if ("reason" in bearer) {
    await recordRefusal(request, {
      reason: bearer.reason,
      keyPrefix: null,
      scope,
      requestId: options.requestId,
    })
    throw new PartnerApiError("invalid_api_key", INVALID_KEY_MESSAGE)
  }

  const presentedKey = bearer.token
  const parsedKey = parsePartnerApiKey(presentedKey)

  if (!parsedKey) {
    await recordRefusal(request, {
      reason: "malformed_key",
      keyPrefix: getSafePartnerApiKeyPrefix(presentedKey),
      scope,
      requestId: options.requestId,
    })
    throw new PartnerApiError("invalid_api_key", INVALID_KEY_MESSAGE)
  }

  const presentedHash = hashPartnerApiKey(presentedKey)
  const apiKey = await prisma.partnerApiKey.findUnique({
    where: { hashedKey: presentedHash },
    include: { vendor: true },
  })

  if (!apiKey || !partnerApiKeyHashesMatch(apiKey.hashedKey, presentedHash)) {
    await recordRefusal(request, {
      reason: "unknown_key",
      keyPrefix: parsedKey.prefix,
      scope,
      requestId: options.requestId,
    })
    throw new PartnerApiError("invalid_api_key", INVALID_KEY_MESSAGE)
  }

  const { vendor: vendorProfile, ...apiKeyRecord } = apiKey

  if (apiKeyRecord.revokedAt) {
    await recordRefusal(request, {
      reason: "revoked_key",
      keyPrefix: apiKeyRecord.prefix,
      apiKeyId: apiKeyRecord.id,
      vendorId: apiKeyRecord.vendorId,
      scope,
      requestId: options.requestId,
    })
    throw new PartnerApiError("invalid_api_key", INVALID_KEY_MESSAGE)
  }

  const rateLimit = partnerApiRateLimiter.consume(apiKeyRecord.id)

  if (!rateLimit.allowed) {
    await recordRefusal(request, {
      reason: "rate_limited",
      keyPrefix: apiKeyRecord.prefix,
      apiKeyId: apiKeyRecord.id,
      vendorId: apiKeyRecord.vendorId,
      scope,
      requestId: options.requestId,
    })
    throw new PartnerApiError("rate_limited", "Too many requests for this API key. Retry later.", {
      details: { limit: rateLimit.limit, retryAfterSeconds: rateLimit.retryAfterSeconds },
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    })
  }

  if (!hasPartnerApiScope(apiKeyRecord.scopes, scope)) {
    await recordRefusal(request, {
      reason: "insufficient_scope",
      keyPrefix: apiKeyRecord.prefix,
      apiKeyId: apiKeyRecord.id,
      vendorId: apiKeyRecord.vendorId,
      scope,
      requestId: options.requestId,
    })
    throw new PartnerApiError("insufficient_scope", `This API key does not have the "${scope}" scope.`, {
      details: { requiredScope: scope },
    })
  }

  await touchLastUsedAt(apiKeyRecord, new Date())

  return { vendorProfile, apiKey: apiKeyRecord }
}
