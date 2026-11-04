import { NextResponse } from "next/server"

import { openPartnerContract } from "@/features/partner-api/server/partner-bookings"
import { partnerContractOpenSchema } from "@/features/partner-api/schemas/booking.schema"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Opens the contract of a booking signed at pickup (scope `bookings:write`, LOCAZ M11.1) with the rental as handed
 * over: `rental.departure` holds the check-in readings printed on the contract. The customer then reads and signs it
 * through `checkout/contract`, `contract/accept` and `checkout/signature`.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerContractOpenSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await openPartnerContract({ request, vendorProfile, apiKey, requestId }, id, input))
})
