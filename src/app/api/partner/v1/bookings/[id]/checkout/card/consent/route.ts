import { NextResponse } from "next/server"

import { CUSTOMER_IP_HEADER, CUSTOMER_USER_AGENT_HEADER, partnerCheckoutCardConsentSchema } from "@/features/partner-api/schemas/checkout.schema"
import { recordPartnerCheckoutCardConsent } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * The customer's consent to later charges on the saved card (scope `bookings:write`): `{ consentVersion, textFr,
 * textEn }`, the exact words shown, kept with the customer's IP and browser (`Contrazy-Customer-Ip`,
 * `Contrazy-Customer-User-Agent`). Answers the checkout state.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerCheckoutCardConsentSchema, await readPartnerJsonBody(request))
  const evidence = {
    ip: request.headers.get(CUSTOMER_IP_HEADER)?.trim().slice(0, 64) || null,
    userAgent: request.headers.get(CUSTOMER_USER_AGENT_HEADER)?.trim().slice(0, 512) || null,
  }

  return NextResponse.json(await recordPartnerCheckoutCardConsent({ vendorProfile }, id, input, evidence))
})
