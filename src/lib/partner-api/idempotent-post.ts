import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { PartnerApiError } from "@/lib/partner-api/errors"
import {
  hashIdempotentRequest,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  isValidIdempotencyKey,
} from "@/lib/partner-api/idempotency"
import { completeIdempotencyKey, releaseIdempotencyKey, reserveIdempotencyKey } from "@/lib/partner-api/idempotency-store"

/**
 * A partner POST that moves money (pickup hold, capture, release): requires an
 * `Idempotency-Key`; the same key and body replay the first response, the same
 * key with another body is 409 `idempotency_key_conflict`, and a failed call
 * frees the key so it can be retried. Same rules as booking creation.
 */
export async function runIdempotentPartnerPost<T>(
  request: Request,
  input: { vendorId: string; path: string; body: unknown; status: number; transactionId?: string; run: (idempotencyKey: string) => Promise<T> }
) {
  const idempotencyKey = request.headers.get(IDEMPOTENCY_KEY_HEADER)

  if (!isValidIdempotencyKey(idempotencyKey)) {
    throw new PartnerApiError("idempotency_key_required", "Send an Idempotency-Key header (1-255 printable ASCII characters), unique per operation.")
  }

  const reservation = await reserveIdempotencyKey({
    vendorId: input.vendorId,
    key: idempotencyKey,
    requestHash: hashIdempotentRequest({ method: "POST", path: input.path, body: input.body }),
  })

  if (reservation.kind === "replay") {
    return NextResponse.json(reservation.body, { status: reservation.status, headers: { [IDEMPOTENCY_REPLAYED_HEADER]: "true" } })
  }

  try {
    const result = await input.run(idempotencyKey)

    await completeIdempotencyKey(reservation.id, {
      status: input.status,
      body: result as unknown as Prisma.InputJsonValue,
      transactionId: input.transactionId,
    })

    return NextResponse.json(result, { status: input.status })
  } catch (error) {
    await releaseIdempotencyKey(reservation.id)
    throw error
  }
}
