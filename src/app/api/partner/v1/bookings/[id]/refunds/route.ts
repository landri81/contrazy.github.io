import { partnerBookingRefundSchema } from "@/features/partner-api/schemas/card-charges.schema"
import { refundPartnerBookingPayment } from "@/features/partner-api/server/partner-payment-refunds"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { runIdempotentPartnerPost } from "@/lib/partner-api/idempotent-post"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Refunds the booking's rental payment at Stripe (scope `bookings:write`, `Idempotency-Key` required):
 * `{ amount?, reason }`, all of what is left without amount. 409 `payment_not_refundable`, 422 `refund_too_large`.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const body = await readPartnerJsonBody(request)
  const input = parsePartnerBody(partnerBookingRefundSchema, body)

  return runIdempotentPartnerPost(request, {
    vendorId: vendorProfile.id,
    path: `/api/partner/v1/bookings/${id}/refunds`,
    body,
    status: 201,
    run: () => refundPartnerBookingPayment({ vendorProfile, apiKey }, id, input),
  })
})
