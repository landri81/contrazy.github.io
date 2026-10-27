import { NextResponse } from "next/server"

import { partnerCheckoutContractAcceptSchema } from "@/features/partner-api/schemas/checkout.schema"
import { acceptPartnerCheckoutContract } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/** The customer read the agreement (scope `bookings:write`): `{ version }`; 409 `version_mismatch` if it changed since. */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerCheckoutContractAcceptSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await acceptPartnerCheckoutContract({ vendorProfile }, id, input))
})
