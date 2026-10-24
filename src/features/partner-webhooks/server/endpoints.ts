import { randomBytes } from "node:crypto"
import type { PartnerWebhookDelivery, PartnerWebhookEndpoint, Prisma } from "@prisma/client"

import { buildPartnerPingPayload } from "@/features/partner-webhooks/payload"
import type { PartnerWebhookEndpointCreateInput } from "@/features/partner-webhooks/schemas/endpoint.schema"
import { sendPartnerWebhookDeliveryNow } from "@/features/partner-webhooks/server/delivery-worker"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { PartnerApiError } from "@/lib/partner-api/errors"
import { PARTNER_WEBHOOK_PING_EVENT } from "@/lib/partner-webhooks/catalogue"
import { allowLocalWebhookUrls, checkPartnerWebhookUrl } from "@/lib/partner-webhooks/endpoint-url"
import {
  encryptPartnerWebhookSecret,
  generatePartnerWebhookSecret,
  getPartnerWebhookSecretDisplayPrefix,
} from "@/lib/partner-webhooks/secrets"

export const PARTNER_WEBHOOK_ENDPOINT_MAX_ACTIVE = 10

const URL_REFUSAL_MESSAGES = {
  invalid_url: "url must be an absolute URL.",
  https_required: "url must use https:// (http:// is accepted only for localhost outside production).",
  credentials_not_allowed: "url must not contain a username or password.",
  private_address: "url must point to a public host.",
} as const

type PartnerCaller = { vendorId: string; apiKeyId: string; apiKeyPrefix: string; requestId: string }

export function serializePartnerWebhookEndpoint(endpoint: PartnerWebhookEndpoint) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    description: endpoint.description,
    eventTypes: endpoint.eventTypes,
    active: endpoint.active,
    secretPrefix: endpoint.secretPrefix,
    createdAt: endpoint.createdAt.toISOString(),
  }
}

export function serializePartnerWebhookDelivery(delivery: PartnerWebhookDelivery) {
  return {
    id: delivery.id,
    endpointId: delivery.endpointId,
    eventId: delivery.eventId,
    eventType: delivery.eventType,
    status: delivery.status.toLowerCase(),
    attempt: delivery.attempt,
    responseStatus: delivery.responseStatus,
    responseBodySnippet: delivery.responseBodySnippet,
    error: delivery.lastError,
    nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
    lastAttemptAt: delivery.lastAttemptAt?.toISOString() ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
  }
}

function auditEntry(caller: PartnerCaller, action: string, endpoint: PartnerWebhookEndpoint, extra: Prisma.InputJsonObject = {}) {
  return {
    actorType: "SYSTEM" as const,
    action,
    entityType: "PartnerWebhookEndpoint",
    entityId: endpoint.id,
    metadata: {
      vendorId: caller.vendorId,
      apiKeyId: caller.apiKeyId,
      keyPrefix: caller.apiKeyPrefix,
      requestId: caller.requestId,
      url: endpoint.url,
      eventTypes: endpoint.eventTypes,
      ...extra,
    },
  }
}

/** Creates an endpoint; the clear `whsec_` secret is returned here once and never again. */
export async function createPartnerWebhookEndpoint(caller: PartnerCaller, input: PartnerWebhookEndpointCreateInput) {
  const urlCheck = checkPartnerWebhookUrl(input.url, { allowLocalhost: allowLocalWebhookUrls(env.NODE_ENV) })

  if (!urlCheck.ok) {
    throw new PartnerApiError("webhook_url_not_allowed", URL_REFUSAL_MESSAGES[urlCheck.reason], {
      details: { reason: urlCheck.reason },
    })
  }

  const activeCount = await prisma.partnerWebhookEndpoint.count({
    where: { vendorId: caller.vendorId, deletedAt: null },
  })

  if (activeCount >= PARTNER_WEBHOOK_ENDPOINT_MAX_ACTIVE) {
    throw new PartnerApiError(
      "webhook_endpoint_limit_reached",
      `A vendor can have at most ${PARTNER_WEBHOOK_ENDPOINT_MAX_ACTIVE} webhook endpoints. Delete one first.`,
      { details: { limit: PARTNER_WEBHOOK_ENDPOINT_MAX_ACTIVE } }
    )
  }

  const secret = generatePartnerWebhookSecret()
  const endpoint = await prisma.$transaction(async (tx) => {
    const created = await tx.partnerWebhookEndpoint.create({
      data: {
        vendorId: caller.vendorId,
        url: urlCheck.url,
        description: input.description || null,
        eventTypes: input.eventTypes,
        encryptedSecret: encryptPartnerWebhookSecret(secret, env.JWT_ENCRYPTION_SECRET),
        secretPrefix: getPartnerWebhookSecretDisplayPrefix(secret),
      },
    })

    await tx.auditLog.create({ data: auditEntry(caller, "partner_webhook_endpoint.created", created) })
    return created
  })

  return { ...serializePartnerWebhookEndpoint(endpoint), secret }
}

export async function listPartnerWebhookEndpoints(vendorId: string) {
  const endpoints = await prisma.partnerWebhookEndpoint.findMany({
    where: { vendorId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  })

  return { data: endpoints.map(serializePartnerWebhookEndpoint) }
}

/** Another vendor's endpoint, or a deleted one, is a plain 404. */
export async function requirePartnerWebhookEndpoint(vendorId: string, endpointId: string) {
  const endpoint = await prisma.partnerWebhookEndpoint.findFirst({
    where: { id: endpointId, vendorId, deletedAt: null },
  })

  if (!endpoint) {
    throw new PartnerApiError("not_found", "No webhook endpoint matches this id for this vendor.")
  }

  return endpoint
}

/**
 * Soft delete: the endpoint stops receiving events, queued deliveries are
 * closed without further retries, and the delivery history stays visible.
 */
export async function deletePartnerWebhookEndpoint(caller: PartnerCaller, endpointId: string) {
  const endpoint = await requirePartnerWebhookEndpoint(caller.vendorId, endpointId)
  const deletedAt = new Date()

  const deleted = await prisma.$transaction(async (tx) => {
    const updated = await tx.partnerWebhookEndpoint.update({
      where: { id: endpoint.id },
      data: { active: false, deletedAt },
    })

    const closed = await tx.partnerWebhookDelivery.updateMany({
      where: { endpointId: endpoint.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "FAILED", nextAttemptAt: null, lastError: "Endpoint deleted." },
    })

    await tx.auditLog.create({
      data: auditEntry(caller, "partner_webhook_endpoint.deleted", updated, { closedDeliveries: closed.count }),
    })

    return updated
  })

  return { id: deleted.id, deleted: true }
}

/** Sends a signed `ping` to the endpoint now and returns the delivery outcome. */
export async function sendPartnerWebhookTestPing(caller: PartnerCaller, endpointId: string) {
  const endpoint = await requirePartnerWebhookEndpoint(caller.vendorId, endpointId)
  const eventId = `evt_${randomBytes(16).toString("hex")}`
  const createdAt = new Date()

  const delivery = await prisma.partnerWebhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      eventId,
      eventType: PARTNER_WEBHOOK_PING_EVENT,
      payload: buildPartnerPingPayload({ eventId, endpointId: endpoint.id, createdAt }) as unknown as Prisma.InputJsonValue,
      status: "PENDING",
      // Pings are sent synchronously only, never by the worker.
      nextAttemptAt: null,
    },
  })

  const result = await sendPartnerWebhookDeliveryNow(caller.vendorId, delivery.id)

  if (result.kind !== "sent") {
    throw new PartnerApiError("not_found", "No webhook endpoint matches this id for this vendor.")
  }

  return { delivery: serializePartnerWebhookDelivery(result.delivery) }
}
