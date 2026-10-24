import { NextResponse } from "next/server"

import { cancelPartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { partnerBookingCancelSchema } from "@/features/partner-api/schemas/booking.schema"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/** Cancels the booking and its customer link with a reason (scope `bookings:write`). */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const { reason } = parsePartnerBody(partnerBookingCancelSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await cancelPartnerBooking({ request, vendorProfile, apiKey, requestId }, id, reason))
})
