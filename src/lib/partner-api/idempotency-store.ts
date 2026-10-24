import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { PartnerApiError } from "@/lib/partner-api/errors"
import { IDEMPOTENCY_STALE_RESERVATION_MS } from "@/lib/partner-api/idempotency"

/** Stored responses are replayed for 24 hours; after that the key can be reused. */
export const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60_000

export type IdempotencyReservation =
  | { kind: "reserved"; id: string }
  | { kind: "replay"; status: number; body: Prisma.JsonValue }

export function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002")
}

function keyInUse() {
  return new PartnerApiError(
    "idempotency_key_in_use",
    "A request with this Idempotency-Key is still being processed. Retry in a few seconds.",
    { headers: { "Retry-After": "2" } }
  )
}

/**
 * Reserves `(vendorId, key)` before the booking is created.
 * - first use: a row is inserted and the caller proceeds;
 * - same key + same request hash, finished: the stored response is replayed;
 * - same key + a different request: 409 `idempotency_key_conflict`;
 * - same key still running: 409 `idempotency_key_in_use` (a reservation left
 *   behind by a crashed request is taken over after 5 minutes).
 */
export async function reserveIdempotencyKey(input: {
  vendorId: string
  key: string
  requestHash: string
  now?: Date
}): Promise<IdempotencyReservation> {
  const now = input.now ?? new Date()

  try {
    const created = await prisma.partnerIdempotencyKey.create({
      data: { vendorId: input.vendorId, key: input.key, requestHash: input.requestHash },
    })
    return { kind: "reserved", id: created.id }
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }
  }

  const existing = await prisma.partnerIdempotencyKey.findUnique({
    where: { vendorId_key: { vendorId: input.vendorId, key: input.key } },
  })

  if (!existing) {
    throw keyInUse()
  }

  const age = now.getTime() - existing.createdAt.getTime()

  if (age > IDEMPOTENCY_KEY_TTL_MS) {
    const renewed = await prisma.partnerIdempotencyKey.updateMany({
      where: { id: existing.id, createdAt: existing.createdAt },
      data: {
        requestHash: input.requestHash,
        responseStatus: null,
        responseBody: Prisma.DbNull,
        transactionId: null,
        completedAt: null,
        createdAt: now,
      },
    })

    if (renewed.count === 0) {
      throw keyInUse()
    }

    return { kind: "reserved", id: existing.id }
  }

  if (existing.requestHash !== input.requestHash) {
    throw new PartnerApiError(
      "idempotency_key_conflict",
      "This Idempotency-Key was already used with a different request. Use a new key for a new booking."
    )
  }

  if (existing.responseStatus !== null && existing.responseBody !== null) {
    return { kind: "replay", status: existing.responseStatus, body: existing.responseBody }
  }

  if (age < IDEMPOTENCY_STALE_RESERVATION_MS) {
    throw keyInUse()
  }

  const takenOver = await prisma.partnerIdempotencyKey.updateMany({
    where: { id: existing.id, createdAt: existing.createdAt, responseStatus: null },
    data: { createdAt: now },
  })

  if (takenOver.count === 0) {
    throw keyInUse()
  }

  return { kind: "reserved", id: existing.id }
}

/** Stores the response so the same key + body replays it. */
export async function completeIdempotencyKey(
  id: string,
  result: { status: number; body: Prisma.InputJsonValue; transactionId?: string | null }
) {
  await prisma.partnerIdempotencyKey.update({
    where: { id },
    data: {
      responseStatus: result.status,
      responseBody: result.body,
      transactionId: result.transactionId ?? null,
      completedAt: new Date(),
    },
  })
}

/**
 * Frees a reservation whose request failed, so the partner can retry with the
 * same key once the cause (plan, allow-list, template…) is fixed. Errors are
 * not stored or replayed.
 */
export async function releaseIdempotencyKey(id: string) {
  try {
    await prisma.partnerIdempotencyKey.deleteMany({ where: { id, responseStatus: null } })
  } catch (error) {
    console.error("Partner idempotency reservation release skipped", {
      id,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
