import { NextResponse } from "next/server"

import { startPartnerCheckoutPayment } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * The payment step of the embedded checkout (scope `bookings:write`), no body: the deposit hold or the rental payment,
 * whichever is next. Answers `{ stage, clientSecret, stripeAccountId, publishableKey, amount, currency }` to confirm
 * with Stripe.js on the vendor's connected account.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params

  return NextResponse.json(await startPartnerCheckoutPayment({ vendorProfile }, id))
})
