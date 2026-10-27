import { NextResponse } from "next/server"

import { CUSTOMER_IP_HEADER, partnerCheckoutSignatureSchema } from "@/features/partner-api/schemas/checkout.schema"
import { signPartnerCheckout } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * The signature of the embedded checkout (scope `bookings:write`): the signed PDF is generated as on Contrazy's page;
 * the customer's IP (`Contrazy-Customer-Ip`) is kept as evidence. Answers the checkout state.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerCheckoutSignatureSchema, await readPartnerJsonBody(request))
  const ip = request.headers.get(CUSTOMER_IP_HEADER)?.trim().slice(0, 64) || null

  return NextResponse.json(await signPartnerCheckout({ vendorProfile }, id, input, ip))
})
