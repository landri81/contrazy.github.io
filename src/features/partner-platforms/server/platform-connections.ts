import { createPartnerApiKey, resolvePartnerApiKeyMode, revokePartnerApiKey } from "@/features/partner-api/server/api-keys"
import { createPartnerWebhookEndpoint, deletePartnerWebhookEndpoint } from "@/features/partner-webhooks/server/endpoints"
import { hasActiveSubscription } from "@/features/subscriptions/server/feature-gates"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { PARTNER_API_SCOPES } from "@/lib/partner-api/scopes"
import { getPartnerPlatform, type PartnerPlatform } from "@/lib/partner-platforms/catalogue"
import { PARTNER_WEBHOOK_EVENT_TYPES } from "@/lib/partner-webhooks/catalogue"
import { decryptPartnerWebhookSecret } from "@/lib/partner-webhooks/secrets"
import { CONTRAZY_SIGNATURE_HEADER, signContrazyPayload } from "@/lib/partner-webhooks/signature"

/**
 * Super admin connection of a partner platform (LOCAZ) to a vendor account: no one signs in to the vendor account and
 * no key is typed anywhere. Contrazy issues the key (marked for the platform), registers the platform's webhook,
 * allows its origin and hands the key and the webhook secret to the platform server to server. The platform trusts
 * the key only after checking the mark with GET /api/partner/v1/ping.
 */

export type PlatformConnectionErrorCode =
  | "vendor_not_found"
  | "vendor_not_approved"
  | "stripe_not_connected"
  | "subscription_required"
  | "platform_refused"
  | "platform_unreachable"
  | "not_connected"

export class PlatformConnectionError extends Error {
  constructor(public readonly code: PlatformConnectionErrorCode, message: string) {
    super(message)
    this.name = "PlatformConnectionError"
  }
}

type Actor = { id: string; email: string }

const HANDOVER_TIMEOUT_MS = 15_000

/** Contrazy's own origin, as the platform calls it back (ping). */
function contrazyOrigin() {
  return (env.NEXT_PUBLIC_APP_URL ?? "https://www.contrazy.com").replace(/\/$/, "")
}

async function postToPlatform(url: string, body: string, headers: Record<string, string> = {}) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(HANDOVER_TIMEOUT_MS),
    })
    const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null
    return { ok: response.ok, status: response.status, message: payload?.message ?? payload?.error ?? `HTTP ${response.status}` }
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "unreachable" }
  }
}

/** The active connection of this platform on this vendor account, with its key prefix. */
export async function getPlatformConnection(vendorId: string, platform: PartnerPlatform) {
  const connection = await prisma.partnerPlatformConnection.findFirst({
    where: { vendorId, platform, disconnectedAt: null },
    orderBy: { connectedAt: "desc" },
  })
  if (!connection) return null
  const apiKey = await prisma.partnerApiKey.findUnique({ where: { id: connection.apiKeyId }, select: { prefix: true, mode: true, revokedAt: true } })
  return { ...connection, keyPrefix: apiKey?.prefix ?? null, keyMode: apiKey?.mode ?? null }
}

function callerFor(vendorId: string, apiKey: { id: string; prefix: string }, platform: PartnerPlatform) {
  return { vendorId, apiKeyId: apiKey.id, apiKeyPrefix: apiKey.prefix, requestId: `platform-${platform}` }
}

/** Connects the platform; a connection already there is replaced (its key revoked, its endpoint removed). */
export async function connectPlatform(vendorId: string, platform: PartnerPlatform, actor: Actor) {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { id: true, businessName: true, reviewStatus: true, stripeConnectionStatus: true, partnerAllowedOrigins: true, subscription: true },
  })
  if (!vendor) throw new PlatformConnectionError("vendor_not_found", "Vendor account not found.")
  if (vendor.reviewStatus !== "APPROVED") throw new PlatformConnectionError("vendor_not_approved", "Approve the vendor account first.")
  if (vendor.stripeConnectionStatus !== "CONNECTED") throw new PlatformConnectionError("stripe_not_connected", "The vendor account has no connected Stripe account.")
  if (!hasActiveSubscription(vendor.subscription)) throw new PlatformConnectionError("subscription_required", "The vendor account has no active subscription (grant the partner plan first).")

  const target = getPartnerPlatform(platform)
  if (await getPlatformConnection(vendorId, platform)) await disconnectPlatform(vendorId, platform, actor, { notify: false })

  const key = await createPartnerApiKey({
    vendorId,
    userId: actor.id,
    mode: resolvePartnerApiKeyMode(env.STRIPE_SECRET_KEY),
    data: { name: `${target.name} (platform connection)`, scopes: [...PARTNER_API_SCOPES] },
    platformPartner: platform,
  })
  const caller = callerFor(vendorId, key.apiKey, platform)
  let endpointId: string | null = null

  try {
    const endpoint = await createPartnerWebhookEndpoint(caller, { url: target.webhookUrl, description: `${target.name} (platform connection)`, eventTypes: [...PARTNER_WEBHOOK_EVENT_TYPES] })
    endpointId = endpoint.id
    if (!vendor.partnerAllowedOrigins.includes(target.origin)) {
      await prisma.vendorProfile.update({ where: { id: vendorId }, data: { partnerAllowedOrigins: { push: target.origin } } })
    }
    const handover = await postToPlatform(
      target.provisionUrl,
      JSON.stringify({ action: "connect", apiUrl: contrazyOrigin(), apiKey: key.secret, webhookSecret: endpoint.secret, webhookEndpointId: endpoint.id, vendorId, vendorName: vendor.businessName }),
    )
    if (!handover.ok) {
      throw new PlatformConnectionError(handover.status === 0 ? "platform_unreachable" : "platform_refused", `${target.name} did not accept the connection: ${handover.message}`)
    }
  } catch (error) {
    // Nothing half-connected: the key and the endpoint created above go away again.
    await revokePartnerApiKey({ vendorId, userId: actor.id, keyId: key.apiKey.id }).catch(() => undefined)
    if (endpointId) await deletePartnerWebhookEndpoint(caller, endpointId).catch(() => undefined)
    throw error instanceof PlatformConnectionError ? error : new PlatformConnectionError("platform_unreachable", error instanceof Error ? error.message : "Connection failed.")
  }

  return prisma.$transaction(async (tx) => {
    const connection = await tx.partnerPlatformConnection.create({
      data: { vendorId, platform, apiKeyId: key.apiKey.id, webhookEndpointId: endpointId, connectedById: actor.id },
    })
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "partner_platform.connected",
        entityType: "PartnerPlatformConnection",
        entityId: connection.id,
        metadata: { vendorId, platform, keyPrefix: key.apiKey.prefix, webhookEndpointId: endpointId, origin: target.origin },
      },
    })
    return connection
  })
}

/**
 * Disconnects the platform: the platform is told first (a request signed with the webhook secret, so it knows it is
 * Contrazy), then the key is revoked and the endpoint removed whatever the platform answered.
 */
export async function disconnectPlatform(vendorId: string, platform: PartnerPlatform, actor: Actor, options: { notify?: boolean } = {}) {
  const connection = await getPlatformConnection(vendorId, platform)
  if (!connection) throw new PlatformConnectionError("not_connected", "This platform is not connected to the vendor account.")
  const target = getPartnerPlatform(platform)

  let notified = false
  if (options.notify !== false && connection.webhookEndpointId) {
    const endpoint = await prisma.partnerWebhookEndpoint.findUnique({ where: { id: connection.webhookEndpointId }, select: { encryptedSecret: true } })
    if (endpoint) {
      const body = JSON.stringify({ action: "disconnect", vendorId, at: new Date().toISOString() })
      const secret = decryptPartnerWebhookSecret(endpoint.encryptedSecret, env.JWT_ENCRYPTION_SECRET)
      notified = (await postToPlatform(target.provisionUrl, body, { [CONTRAZY_SIGNATURE_HEADER]: signContrazyPayload(body, secret) })).ok
    }
  }

  const caller = { vendorId, apiKeyId: connection.apiKeyId, apiKeyPrefix: connection.keyPrefix ?? "", requestId: `platform-${platform}` }
  await revokePartnerApiKey({ vendorId, userId: actor.id, keyId: connection.apiKeyId }).catch(() => undefined)
  if (connection.webhookEndpointId) await deletePartnerWebhookEndpoint(caller, connection.webhookEndpointId).catch(() => undefined)

  await prisma.$transaction(async (tx) => {
    await tx.partnerPlatformConnection.update({ where: { id: connection.id }, data: { disconnectedAt: new Date() } })
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "partner_platform.disconnected", entityType: "PartnerPlatformConnection", entityId: connection.id, metadata: { vendorId, platform, notified } },
    })
  })
  return { notified }
}
