import { NextResponse } from "next/server"

import { listPartnerContractTemplates } from "@/features/partner-api/contract-templates"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"

/** The vendor's contract templates, without their text (LOCAZ, 11 Nov 2026). Requires `bookings:read`. */
export const GET = withPartnerApi(async (request, { requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:read", { requestId })
  return NextResponse.json({ data: await listPartnerContractTemplates(vendorProfile.id) })
})
