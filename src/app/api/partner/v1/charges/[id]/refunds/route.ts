import { partnerChargeRefundSchema, refundPartnerCharge } from "@/features/partner-api/server/partner-charges"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { runIdempotentPartnerPost } from "@/lib/partner-api/idempotent-post"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Refunds a post-rental charge at Stripe (scope `charges:write`,
 * `Idempotency-Key` required): `{ amount?, reason }`, all of what is left
 * without amount. 409 `charge_not_refundable`, 422 `refund_too_large`.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "charges:write", { requestId })
  const { id } = await params
  const body = await readPartnerJsonBody(request)
  const input = parsePartnerBody(partnerChargeRefundSchema, body)

  return runIdempotentPartnerPost(request, {
    vendorId: vendorProfile.id,
    path: `/api/partner/v1/charges/${id}/refunds`,
    body,
    status: 201,
    run: () => refundPartnerCharge({ vendorProfile, apiKey }, id, input),
  })
})
