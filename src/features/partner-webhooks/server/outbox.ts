import { createHash } from "node:crypto"
import type { Prisma, PrismaClient, TransactionEvent } from "@prisma/client"

import { partnerBookingInclude } from "@/features/partner-api/booking-presenter"
import { ONCE_PER_BOOKING_WEBHOOK_EVENTS } from "@/features/partner-webhooks/event-mapping"
import { buildPartnerWebhookPayload } from "@/features/partner-webhooks/payload"
import type { PartnerWebhookSubscribableEventType } from "@/lib/partner-webhooks/catalogue"
import { getSiteUrl } from "@/lib/site-url"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

/**
 * Deterministic event id per (endpoint, source event, type), so a timeline
 * event written again through its dedupe key (upsert) never queues a second
 * delivery: the unique `eventId` makes the insert a no-op. Events that exist
 * once per booking (created, cancelled, completed) are keyed on the booking.
 */
export function derivePartnerWebhookEventId(input: {
  endpointId: string
  transactionId: string
  transactionEventId: string
  type: PartnerWebhookSubscribableEventType
}) {
  const source = ONCE_PER_BOOKING_WEBHOOK_EVENTS.has(input.type)
    ? `booking:${input.transactionId}`
    : `event:${input.transactionEventId}`
  const digest = createHash("sha256").update(`${input.endpointId}|${source}|${input.type}`).digest("hex")

  return `evt_${digest.slice(0, 32)}`
}

/** Vendor of a partner booking, or null for dashboard transactions (they never emit partner webhooks). */
export async function findPartnerWebhookTarget(db: DatabaseClient, transactionId: string) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    select: { source: true, vendorId: true },
  })

  return transaction?.source === "PARTNER_API" ? { vendorId: transaction.vendorId } : null
}

/**
 * Outbox write: one PENDING delivery per active endpoint subscribed to the
 * event, inserted with the caller's database client so it commits (or rolls
 * back) together with the timeline event. The worker sends it later.
 */
export async function enqueuePartnerWebhookDeliveries(
  db: DatabaseClient,
  input: {
    vendorId: string
    event: Pick<TransactionEvent, "id" | "transactionId" | "type" | "occurredAt" | "metadata">
    webhookType: PartnerWebhookSubscribableEventType
    baseUrl?: string
  }
) {
  const endpoints = await db.partnerWebhookEndpoint.findMany({
    where: { vendorId: input.vendorId, active: true, deletedAt: null, eventTypes: { has: input.webhookType } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  if (endpoints.length === 0) {
    return { count: 0 }
  }

  const booking = await db.transaction.findUnique({
    where: { id: input.event.transactionId },
    include: partnerBookingInclude,
  })

  if (!booking) {
    return { count: 0 }
  }

  const baseUrl = input.baseUrl ?? getSiteUrl()
  const now = new Date()

  return db.partnerWebhookDelivery.createMany({
    data: endpoints.map((endpoint) => {
      const eventId = derivePartnerWebhookEventId({
        endpointId: endpoint.id,
        transactionId: booking.id,
        transactionEventId: input.event.id,
        type: input.webhookType,
      })

      return {
        endpointId: endpoint.id,
        transactionId: booking.id,
        transactionEventId: input.event.id,
        eventId,
        eventType: input.webhookType,
        payload: buildPartnerWebhookPayload({
          eventId,
          type: input.webhookType,
          booking,
          event: input.event,
          baseUrl,
        }) as unknown as Prisma.InputJsonValue,
        status: "PENDING" as const,
        nextAttemptAt: now,
      }
    }),
    skipDuplicates: true,
  })
}
