import { NextResponse } from "next/server"

import { partnerCheckoutIdentitySchema } from "@/features/partner-api/schemas/checkout.schema"
import { startPartnerCheckoutIdentity } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * The identity step of the embedded checkout (scope `bookings:write`): `{ returnUrl }` on one of the vendor's allowed
 * origins. Answers `{ clientSecret, url, publishableKey }` for Stripe's identity modal or its hosted page.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerCheckoutIdentitySchema, await readPartnerJsonBody(request))

  return NextResponse.json(await startPartnerCheckoutIdentity({ vendorProfile }, id, input))
})
