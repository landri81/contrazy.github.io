// Client-safe: no Node-only imports, so dashboard components can use the scope list.

/**
 * Scopes a partner API key can hold. Routes declare the scope they need and
 * `requirePartnerApiKey` refuses keys without it (403 insufficient_scope).
 */
export const PARTNER_API_SCOPES = [
  "bookings:read",
  "bookings:write",
  "charges:write",
  "webhooks:write",
] as const
export type PartnerApiScope = (typeof PARTNER_API_SCOPES)[number]

export function isPartnerApiScope(value: unknown): value is PartnerApiScope {
  return typeof value === "string" && (PARTNER_API_SCOPES as readonly string[]).includes(value)
}

export function hasPartnerApiScope(grantedScopes: readonly string[], requiredScope: PartnerApiScope) {
  return grantedScopes.includes(requiredScope)
}

export function normalizePartnerApiScopes(scopes: readonly string[]) {
  return PARTNER_API_SCOPES.filter((scope) => scopes.includes(scope))
}
