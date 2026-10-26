import type { PartnerWebhookDelivery, PartnerWebhookDeliveryStatus, PartnerWebhookEndpoint, Prisma } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { getPartnerWebhookRetryAt } from "@/lib/partner-webhooks/backoff"
import { PARTNER_WEBHOOK_PING_EVENT } from "@/lib/partner-webhooks/catalogue"
import { allowLocalWebhookUrls, checkPartnerWebhookUrl } from "@/lib/partner-webhooks/endpoint-url"
import { decryptPartnerWebhookSecret } from "@/lib/partner-webhooks/secrets"
import { postSignedWebhook, type WebhookSendResult } from "@/lib/partner-webhooks/transport"

/** A claimed delivery is hidden from other runs for this long (crash safety). */
export const DELIVERY_CLAIM_LEASE_MS = 2 * 60_000

const RETRYABLE_STATUSES: PartnerWebhookDeliveryStatus[] = ["PENDING", "FAILED"]

export type DeliveryMode = "automatic" | "manual"

export type WorkerOptions = {
  now?: () => Date
  maxEndpoints?: number
  maxDeliveriesPerEndpoint?: number
  concurrency?: number
  timeBudgetMs?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export type WorkerSummary = {
  endpoints: number
  attempted: number
  succeeded: number
  retried: number
  dead: number
  skipped: number
}

type DeliveryOutcome = "succeeded" | "retried" | "dead" | "failed"

function decryptSecret(endpoint: Pick<PartnerWebhookEndpoint, "encryptedSecret">) {
  return decryptPartnerWebhookSecret(endpoint.encryptedSecret, env.JWT_ENCRYPTION_SECRET)
}

/**
 * Next state after one attempt. Automatic attempts follow the backoff
 * schedule (DEAD when it runs out). A manual resend never changes the
 * automatic schedule: success ends it, failure keeps whatever was planned.
 */
export function resolveDeliveryUpdate(
  delivery: Pick<PartnerWebhookDelivery, "attempt" | "status" | "nextAttemptAt">,
  result: WebhookSendResult,
  mode: DeliveryMode,
  attemptedAt: Date
): { outcome: DeliveryOutcome; data: Prisma.PartnerWebhookDeliveryUpdateInput } {
  const attempt = delivery.attempt + 1
  const common = {
    attempt,
    lastAttemptAt: attemptedAt,
    responseStatus: result.status,
    responseBodySnippet: result.bodySnippet,
    lastError: result.error,
  }

  if (result.ok) {
    return {
      outcome: "succeeded",
      data: { ...common, status: "SUCCEEDED", deliveredAt: attemptedAt, nextAttemptAt: null },
    }
  }

  if (mode === "manual") {
    const keepsSchedule = delivery.status === "FAILED" || delivery.status === "PENDING"
    return {
      outcome: "failed",
      data: {
        ...common,
        status: delivery.status === "DEAD" ? "DEAD" : "FAILED",
        nextAttemptAt: keepsSchedule ? delivery.nextAttemptAt : null,
      },
    }
  }

  const retryAt = getPartnerWebhookRetryAt(attempt, attemptedAt)

  return retryAt
    ? { outcome: "retried", data: { ...common, status: "FAILED", nextAttemptAt: retryAt } }
    : { outcome: "dead", data: { ...common, status: "DEAD", nextAttemptAt: null } }
}

async function attemptDelivery(
  delivery: PartnerWebhookDelivery,
  endpoint: PartnerWebhookEndpoint,
  secret: string,
  mode: DeliveryMode,
  options: Pick<WorkerOptions, "now" | "timeoutMs" | "fetchImpl">
) {
  const attemptedAt = options.now?.() ?? new Date()
  const allowLocalhost = allowLocalWebhookUrls(env.NODE_ENV)
  const urlCheck = checkPartnerWebhookUrl(endpoint.url, { allowLocalhost })
  const result: WebhookSendResult = urlCheck.ok
    ? await postSignedWebhook({
        url: urlCheck.url,
        secret,
        rawBody: JSON.stringify(delivery.payload),
        eventId: delivery.eventId,
        eventType: delivery.eventType,
        attempt: delivery.attempt + 1,
        allowLocalhost,
        timeoutMs: options.timeoutMs,
        fetchImpl: options.fetchImpl,
      })
    : { ok: false, status: null, bodySnippet: null, error: "The endpoint URL is no longer allowed.", durationMs: 0 }

  const { outcome, data } = resolveDeliveryUpdate(delivery, result, mode, attemptedAt)
  const updated = await prisma.partnerWebhookDelivery.update({ where: { id: delivery.id }, data })

  return { outcome, delivery: updated }
}

/** Oldest unfinished delivery of an endpoint: per-endpoint order is by createdAt. */
function findQueueHead(endpointId: string) {
  return prisma.partnerWebhookDelivery.findFirst({
    where: {
      endpointId,
      status: { in: RETRYABLE_STATUSES },
      nextAttemptAt: { not: null },
      eventType: { not: PARTNER_WEBHOOK_PING_EVENT },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })
}

/**
 * Sends one endpoint's due deliveries in createdAt order, one at a time. A
 * delivery waiting for its retry blocks the newer ones (strict ordering), and
 * the endpoint stops for this run at its first failure.
 */
async function drainEndpoint(endpointId: string, summary: WorkerSummary, options: Required<Pick<WorkerOptions, "maxDeliveriesPerEndpoint">> & WorkerOptions & { deadline: number }) {
  const endpoint = await prisma.partnerWebhookEndpoint.findUnique({ where: { id: endpointId } })

  if (!endpoint || !endpoint.active || endpoint.deletedAt) {
    summary.skipped++
    return
  }

  let secret: string

  try {
    secret = decryptSecret(endpoint)
  } catch {
    console.error("Partner webhook secret could not be decrypted", { endpointId })
    summary.skipped++
    return
  }

  for (let sent = 0; sent < options.maxDeliveriesPerEndpoint && Date.now() < options.deadline; sent++) {
    const now = options.now?.() ?? new Date()
    const head = await findQueueHead(endpointId)

    if (!head?.nextAttemptAt || head.nextAttemptAt > now) {
      return
    }

    // Optimistic claim: only one run sends a given attempt.
    const claim = await prisma.partnerWebhookDelivery.updateMany({
      where: { id: head.id, status: head.status, attempt: head.attempt, nextAttemptAt: head.nextAttemptAt },
      data: { nextAttemptAt: new Date(now.getTime() + DELIVERY_CLAIM_LEASE_MS) },
    })

    if (claim.count !== 1) {
      return
    }

    summary.attempted++
    const { outcome } = await attemptDelivery(head, endpoint, secret, "automatic", options)

    if (outcome === "succeeded") {
      summary.succeeded++
      continue
    }

    if (outcome === "dead") {
      summary.dead++
      // A DEAD delivery no longer blocks the queue; the next one goes in the next run.
    } else {
      summary.retried++
    }

    return
  }
}

/** One worker run (cron): every endpoint with due work, a few endpoints in parallel. */
export async function runPartnerWebhookWorker(options: WorkerOptions = {}): Promise<WorkerSummary> {
  const now = options.now?.() ?? new Date()
  const settings = {
    ...options,
    maxDeliveriesPerEndpoint: options.maxDeliveriesPerEndpoint ?? 25,
    deadline: Date.now() + (options.timeBudgetMs ?? 45_000),
  }
  // Endpoints with work due, the longest-waiting first.
  const due = await prisma.partnerWebhookDelivery.groupBy({
    by: ["endpointId"],
    where: {
      status: { in: RETRYABLE_STATUSES },
      nextAttemptAt: { lte: now },
      eventType: { not: PARTNER_WEBHOOK_PING_EVENT },
    },
    _min: { nextAttemptAt: true },
    orderBy: { _min: { nextAttemptAt: "asc" } },
    take: options.maxEndpoints ?? 50,
  })
  const summary: WorkerSummary = { endpoints: due.length, attempted: 0, succeeded: 0, retried: 0, dead: 0, skipped: 0 }
  const queue = due.map((row) => row.endpointId)
  const concurrency = Math.max(1, options.concurrency ?? 5)

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let endpointId = queue.shift(); endpointId; endpointId = queue.shift()) {
        try {
          await drainEndpoint(endpointId, summary, settings)
        } catch (error) {
          summary.skipped++
          console.error("Partner webhook endpoint run failed", {
            endpointId,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }
    })
  )

  return summary
}

/**
 * Sends a delivery now, outside the schedule (dashboard "Resend", endpoint
 * test). Scoped to the vendor: another vendor's delivery is null (404).
 */
export async function sendPartnerWebhookDeliveryNow(
  vendorId: string,
  deliveryId: string,
  options: Pick<WorkerOptions, "now" | "timeoutMs" | "fetchImpl"> = {}
) {
  const delivery = await prisma.partnerWebhookDelivery.findFirst({
    where: { id: deliveryId, endpoint: { vendorId } },
    include: { endpoint: true },
  })

  if (!delivery) {
    return { kind: "not_found" as const }
  }

  if (delivery.endpoint.deletedAt || !delivery.endpoint.active) {
    return { kind: "endpoint_inactive" as const }
  }

  const { endpoint, ...row } = delivery
  const { outcome, delivery: updated } = await attemptDelivery(row, endpoint, decryptSecret(endpoint), "manual", options)

  return { kind: "sent" as const, outcome, delivery: updated }
}
