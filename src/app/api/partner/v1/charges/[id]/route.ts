import { NextResponse } from "next/server"

import { getPartnerCharge } from "@/features/partner-api/server/partner-charges"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"

/** A post-rental charge with its current status (scope `charges:write`). */
export const GET = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "charges:write", { requestId })
  const { id } = await params

  return NextResponse.json(await getPartnerCharge({ vendorProfile, apiKey }, id))
})
