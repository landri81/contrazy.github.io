import { NextResponse } from "next/server"

import { getPartnerBooking, updatePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { partnerBookingUpdateSchema } from "@/features/partner-api/schemas/booking.schema"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/** Booking status, per-step progress, signed PDF, check-in/out and payment summaries (scope `bookings:read`). */
export const GET = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:read", { requestId })
  const { id } = await params

  return NextResponse.json(await getPartnerBooking(vendorProfile.id, { id }))
})

/**
 * Changes dates, rental details, amounts or steps (scope `bookings:write`) until
 * the customer opens the link; after that 409 `booking_locked`, audited.
 */
export const PATCH = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerBookingUpdateSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await updatePartnerBooking({ request, vendorProfile, apiKey, requestId }, id, input))
})
