import { NextResponse } from "next/server"

import { getPartnerCheckoutContract } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"

/** The agreement of the embedded checkout (scope `bookings:read`): `{ html, version, locale }`, to show then accept. */
export const GET = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:read", { requestId })
  const { id } = await params

  return NextResponse.json(await getPartnerCheckoutContract({ vendorProfile }, id))
})
