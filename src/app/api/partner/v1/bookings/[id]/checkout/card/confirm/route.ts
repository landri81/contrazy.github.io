import { NextResponse } from "next/server"

import { partnerCheckoutCardConfirmSchema } from "@/features/partner-api/schemas/checkout.schema"
import { confirmPartnerCheckoutCard } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * After Stripe.js confirmed the SetupIntent in the browser (scope `bookings:write`): `{ setupIntentId }`, read at
 * Stripe, the card marked saved. A refused card answers `402 payment_failed`. Answers the checkout state.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerCheckoutCardConfirmSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await confirmPartnerCheckoutCard({ vendorProfile }, id, input))
})
