import { NextResponse } from "next/server"

import { listPartnerChecklists } from "@/features/partner-api/checklists"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"

/** The vendor's checklists with their items and example images (LOCAZ, 11 Nov 2026). Requires `bookings:read`. */
export const GET = withPartnerApi(async (request, { requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:read", { requestId })
  return NextResponse.json({ data: await listPartnerChecklists(vendorProfile.id) })
})
