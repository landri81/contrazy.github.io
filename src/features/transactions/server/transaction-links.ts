import {
  Prisma,
  PrismaClient,
  TransactionLinkActor,
  TransactionLinkStatus,
  TransactionStatus,
} from "@prisma/client"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

export function isLiveLinkStatus(status: TransactionLinkStatus) {
  return status === TransactionLinkStatus.ACTIVE || status === TransactionLinkStatus.PROCESSING
}

export function isEditableLinkStatus(status: TransactionLinkStatus) {
  return status === TransactionLinkStatus.ACTIVE
}

export function isCancellableLinkStatus(status: TransactionLinkStatus) {
  return status === TransactionLinkStatus.ACTIVE || status === TransactionLinkStatus.PROCESSING
}

export async function getClientLinkAccessContext(token: string) {
  let link = await prisma.transactionLink.findUnique({
    where: { token },
    include: {
      transaction: true,
    },
  })

  if (!link?.transaction) {
    return { state: "missing" as const }
  }

  if (
    link.expiresAt &&
    link.expiresAt.getTime() <= Date.now() &&
    isLiveLinkStatus(link.status)
  ) {
    await cancelTransactionLink(prisma, {
      linkId: link.id,
      actor: TransactionLinkActor.SYSTEM,
      reason: "The secure link expired.",
      detail: "The secure link expired before the customer completed the flow.",
      title: "Secure link expired",
    })

    link = await prisma.transactionLink.findUnique({
      where: { token },
      include: {
        transaction: true,
      },
    })
  }

  if (!link?.transaction) {
    return { state: "missing" as const }
  }

  if (link.status === TransactionLinkStatus.CANCELLED) {
    return { state: "cancelled" as const, link }
  }

  return { state: "active" as const, link }
}

export async function markTransactionLinkOpened(
  db: DatabaseClient,
  input: { linkId: string; transactionId: string; occurredAt?: Date }
) {
  const occurredAt = input.occurredAt ?? new Date()

  const { count } = await db.transactionLink.updateMany({
    where: {
      id: input.linkId,
      status: TransactionLinkStatus.ACTIVE,
      openedAt: null,
    },
    data: {
      status: TransactionLinkStatus.PROCESSING,
      openedAt: occurredAt,
    },
  })

  if (count === 0) {
    return false
  }

  await recordTransactionEvent(db, {
    transactionId: input.transactionId,
    type: "LINK_OPENED",
    title: "Client opened the secure link",
    detail: "The customer accessed the transaction flow.",
    occurredAt,
    dedupeKey: `event:link-opened:${input.transactionId}`,
  })

  return true
}

export async function markTransactionLinkCompleted(
  db: DatabaseClient,
  input: { linkId: string; transactionId: string; occurredAt?: Date }
) {
  const occurredAt = input.occurredAt ?? new Date()

  await db.transactionLink.updateMany({
    where: {
      id: input.linkId,
      status: {
        notIn: [TransactionLinkStatus.CANCELLED, TransactionLinkStatus.COMPLETED],
      },
    },
    data: {
      status: TransactionLinkStatus.COMPLETED,
      completedAt: occurredAt,
    },
  })
}

export async function cancelTransactionLink(
  db: DatabaseClient,
  input: {
    linkId: string
    actor: TransactionLinkActor
    reason?: string | null
    detail?: string | null
    title?: string
  }
) {
  const link = await db.transactionLink.findUnique({
    where: { id: input.linkId },
    include: {
      transaction: {
        select: {
          id: true,
          reference: true,
          status: true,
        },
      },
    },
  })

  if (!link) {
    return { ok: false as const, code: "NOT_FOUND" as const }
  }

  if (link.status === TransactionLinkStatus.CANCELLED) {
    return { ok: false as const, code: "ALREADY_CANCELLED" as const, link }
  }

  if (link.status === TransactionLinkStatus.COMPLETED || link.transaction.status === TransactionStatus.COMPLETED) {
    return { ok: false as const, code: "COMPLETED" as const, link }
  }

  const cancelledAt = new Date()
  const cancelReason = input.reason?.trim() || null
  const detail =
    input.detail?.trim() ||
    (cancelReason ? `The secure link is no longer available. Reason: ${cancelReason}` : "The secure link is no longer available.")

  const executeCancellation = async (tx: DatabaseClient) => {
    const nextLink = await tx.transactionLink.update({
      where: { id: input.linkId },
      data: {
        status: TransactionLinkStatus.CANCELLED,
        cancelledAt,
        cancelReason,
        cancelledBy: input.actor,
      },
    })

    if (link.transaction.status !== TransactionStatus.CANCELLED) {
      await tx.transaction.update({
        where: { id: link.transaction.id },
        data: { status: TransactionStatus.CANCELLED },
      })
    }

    await recordTransactionEvent(tx, {
      transactionId: link.transaction.id,
      type: "LINK_CANCELLED",
      title: input.title ?? "Secure link cancelled",
      detail,
      metadata: {
        actor: input.actor,
        reason: cancelReason,
      },
      dedupeKey: `event:link-cancelled:${link.transaction.id}`,
    })

    return nextLink
  }

  const updatedLink =
    "$transaction" in db
      ? await db.$transaction(async (tx) => executeCancellation(tx))
      : await executeCancellation(db)

  return {
    ok: true as const,
    link: updatedLink,
    transactionId: link.transaction.id,
  }
}
