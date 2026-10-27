import { NextResponse } from "next/server"

import { getPartnerCheckout } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"

/**
 * The checkout state of a booking (scope `bookings:read`): which steps are asked and done, the next one, the
 * documents asked, the identity check, the contract and the payment stage. Embedded checkout, see the API README.
 */
export const GET = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:read", { requestId })
  const { id } = await params

  return NextResponse.json(await getPartnerCheckout({ vendorProfile }, id))
})
