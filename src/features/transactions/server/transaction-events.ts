import { Prisma, PrismaClient, TransactionEventType } from "@prisma/client"

import { getPartnerWebhookEventType } from "@/features/partner-webhooks/event-mapping"
import {
  enqueuePartnerWebhookDeliveries,
  findPartnerWebhookTarget,
} from "@/features/partner-webhooks/server/outbox"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

type RecordTransactionEventInput = {
  transactionId: string
  type: TransactionEventType
  title: string
  detail?: string | null
  metadata?: Prisma.InputJsonValue
  occurredAt?: Date
  dedupeKey?: string
}

async function writeTransactionEvent(db: DatabaseClient, input: RecordTransactionEventInput) {
  const data = {
    transactionId: input.transactionId,
    type: input.type,
    title: input.title,
    detail: input.detail ?? null,
    metadata: input.metadata,
    occurredAt: input.occurredAt ?? new Date(),
    dedupeKey: input.dedupeKey,
  }

  if (!input.dedupeKey) {
    return db.transactionEvent.create({ data })
  }

  return db.transactionEvent.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {
      title: data.title,
      detail: data.detail,
      metadata: data.metadata,
      occurredAt: data.occurredAt,
    },
    create: data,
  })
}

/**
 * Writes a timeline event. For partner bookings (`source = PARTNER_API`) and
 * event types mapped to a partner webhook, the outbox delivery rows are
 * written in the same database transaction (the caller's, or a new one), so a
 * recorded step can never miss its webhook. Dashboard transactions take the
 * plain write path.
 */
export async function recordTransactionEvent(db: DatabaseClient, input: RecordTransactionEventInput) {
  const webhookType = getPartnerWebhookEventType(input.type)
  const partnerTarget = webhookType ? await findPartnerWebhookTarget(db, input.transactionId) : null

  if (!webhookType || !partnerTarget) {
    return writeTransactionEvent(db, input)
  }

  const writeWithOutbox = async (tx: DatabaseClient) => {
    const event = await writeTransactionEvent(tx, input)
    await enqueuePartnerWebhookDeliveries(tx, { vendorId: partnerTarget.vendorId, event, webhookType })
    return event
  }

  return "$transaction" in db ? db.$transaction((tx) => writeWithOutbox(tx)) : writeWithOutbox(db)
}
