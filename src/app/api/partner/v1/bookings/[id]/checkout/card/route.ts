import { NextResponse } from "next/server"

import { startPartnerCheckoutCard } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * The card saved on its own (scope `bookings:write`), no body, when nothing is charged now and after the consent.
 * Answers `{ clientSecret, stripeAccountId, publishableKey }` to confirm the SetupIntent with Stripe.js.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params

  return NextResponse.json(await startPartnerCheckoutCard({ vendorProfile }, id))
})
