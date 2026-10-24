import { Prisma, PrismaClient, TransactionEventType } from "@prisma/client"

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

export async function recordTransactionEvent(db: DatabaseClient, input: RecordTransactionEventInput) {
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
