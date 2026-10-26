import { NextResponse } from "next/server"

import { detachPartnerCustomerCards } from "@/features/partner-api/server/partner-card-window"
import { partnerDetachCardSchema } from "@/features/partner-api/schemas/card-charges.schema"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Detaches the customer's saved cards at Stripe (scope `bookings:write`). The
 * id is `cardSecurity.customerId` of a booking. 409 `card_in_use` with
 * `details.blockingBookings` while a booking is not returned, still within its
 * 90-day window, or has an open dispute.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  parsePartnerBody(partnerDetachCardSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await detachPartnerCustomerCards({ vendorProfile, apiKey }, id))
})
