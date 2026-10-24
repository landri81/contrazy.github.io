import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { createPartnerBooking, getPartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { partnerBookingCreateSchema } from "@/features/partner-api/schemas/booking.schema"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { PartnerApiError, withPartnerApi } from "@/lib/partner-api/errors"
import {
  hashIdempotentRequest,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  isValidIdempotencyKey,
} from "@/lib/partner-api/idempotency"
import {
  completeIdempotencyKey,
  releaseIdempotencyKey,
  reserveIdempotencyKey,
} from "@/lib/partner-api/idempotency-store"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

const BOOKINGS_PATH = "/api/partner/v1/bookings"

/**
 * Creates a booking (scope `bookings:write`). `Idempotency-Key` is required:
 * the same key and body replay the first 201 response, the same key with a
 * different body is 409 `idempotency_key_conflict`.
 */
export const POST = withPartnerApi(async (request, { requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const idempotencyKey = request.headers.get(IDEMPOTENCY_KEY_HEADER)

  if (!isValidIdempotencyKey(idempotencyKey)) {
    throw new PartnerApiError(
      "idempotency_key_required",
      "Send an Idempotency-Key header (1-255 printable ASCII characters), unique per booking."
    )
  }

  const body = await readPartnerJsonBody(request)
  const input = parsePartnerBody(partnerBookingCreateSchema, body)
  const reservation = await reserveIdempotencyKey({
    vendorId: vendorProfile.id,
    key: idempotencyKey,
    requestHash: hashIdempotentRequest({ method: "POST", path: BOOKINGS_PATH, body }),
  })

  if (reservation.kind === "replay") {
    return NextResponse.json(reservation.body, {
      status: reservation.status,
      headers: { [IDEMPOTENCY_REPLAYED_HEADER]: "true" },
    })
  }

  try {
    const booking = await createPartnerBooking({ request, vendorProfile, apiKey, requestId }, input)

    await completeIdempotencyKey(reservation.id, {
      status: 201,
      body: booking as unknown as Prisma.InputJsonValue,
      transactionId: booking.id,
    })

    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    await releaseIdempotencyKey(reservation.id)
    throw error
  }
})

/** Looks a booking up by the partner's own reference: `GET ?externalRef=` (scope `bookings:read`). */
export const GET = withPartnerApi(async (request, { requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:read", { requestId })
  const externalRef = new URL(request.url).searchParams.get("externalRef")?.trim()

  if (!externalRef) {
    throw new PartnerApiError("invalid_request", "Pass ?externalRef=<your booking reference>, or use GET /bookings/{id}.", {
      details: { issues: [{ path: "externalRef", message: "externalRef is required" }] },
    })
  }

  return NextResponse.json(await getPartnerBooking(vendorProfile.id, { externalRef }))
})
