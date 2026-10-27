import { NextResponse } from "next/server"

import { partnerCheckoutPaymentConfirmSchema } from "@/features/partner-api/schemas/checkout.schema"
import { confirmPartnerCheckoutPayment } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * After Stripe.js confirmed the payment in the browser (scope `bookings:write`): `{ paymentIntentId }`, read at Stripe
 * and recorded. A refused card answers `402 payment_failed` with Stripe's message for the customer. Answers the
 * checkout state.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerCheckoutPaymentConfirmSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await confirmPartnerCheckoutPayment({ vendorProfile }, id, input))
})
