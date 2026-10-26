import { settlePartnerHold } from "@/features/partner-api/server/partner-holds"
import { partnerHoldCancelSchema } from "@/features/partner-api/schemas/card-charges.schema"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { runIdempotentPartnerPost } from "@/lib/partner-api/idempotent-post"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/** Releases the pickup hold (scope `bookings:write`, `Idempotency-Key` required): nothing is charged. */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const body = await readPartnerJsonBody(request)
  parsePartnerBody(partnerHoldCancelSchema, body)

  return runIdempotentPartnerPost(request, {
    vendorId: vendorProfile.id,
    path: `/api/partner/v1/bookings/${id}/hold/cancel`,
    body,
    status: 200,
    transactionId: id,
    run: () => settlePartnerHold({ vendorProfile, apiKey }, id, "release"),
  })
})
