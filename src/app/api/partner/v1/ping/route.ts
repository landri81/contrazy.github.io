import { NextResponse } from "next/server"

import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"

/** Connectivity check for partner integrations. Requires the `bookings:read` scope. */
export const GET = withPartnerApi(async (request, { requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:read", { requestId })

  return NextResponse.json({
    vendorId: vendorProfile.id,
    keyPrefix: apiKey.prefix,
    mode: apiKey.mode,
    scopes: apiKey.scopes,
  })
})
