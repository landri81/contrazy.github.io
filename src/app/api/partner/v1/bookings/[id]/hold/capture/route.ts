import { settlePartnerHold } from "@/features/partner-api/server/partner-holds"
import { partnerHoldCaptureSchema } from "@/features/partner-api/schemas/card-charges.schema"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { runIdempotentPartnerPost } from "@/lib/partner-api/idempotent-post"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/** Captures the pickup hold at return (scope `bookings:write`, `Idempotency-Key` required): `{ amount? }`, at most the authorized amount; without amount, all of it. */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const body = await readPartnerJsonBody(request)
  const input = parsePartnerBody(partnerHoldCaptureSchema, body)

  return runIdempotentPartnerPost(request, {
    vendorId: vendorProfile.id,
    path: `/api/partner/v1/bookings/${id}/hold/capture`,
    body,
    status: 200,
    transactionId: id,
    run: () => settlePartnerHold({ vendorProfile, apiKey }, id, "capture", input.amount),
  })
})
