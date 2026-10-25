import { NextResponse } from "next/server"

import { markPartnerBookingReturned, partnerBookingReturnedSchema } from "@/features/partner-api/server/partner-card-window"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Records the vehicle return (scope `bookings:write`): `{ returnedAt }`, ISO
 * 8601 with offset. Starts the 90-day window for charges on the saved card;
 * sending it again corrects the date. 409 `card_not_secured` without a card.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerBookingReturnedSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await markPartnerBookingReturned({ vendorProfile, apiKey }, id, input))
})
