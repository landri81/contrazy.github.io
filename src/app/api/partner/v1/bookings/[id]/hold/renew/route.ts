import { renewPartnerHold } from "@/features/partner-api/server/partner-holds"
import { partnerHoldRenewSchema } from "@/features/partner-api/schemas/card-charges.schema"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { runIdempotentPartnerPost } from "@/lib/partner-api/idempotent-post"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Renews the pickup hold before the bank lets it lapse (scope `bookings:write`, `Idempotency-Key` required):
 * `{ amount? }`. The new hold is authorized off session on the saved card first, then the old one is released.
 * 409 `hold_not_active` without an authorized card hold; 402 `hold_failed` when the card is declined (the current
 * hold stays).
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const body = await readPartnerJsonBody(request)
  const input = parsePartnerBody(partnerHoldRenewSchema, body)

  return runIdempotentPartnerPost(request, {
    vendorId: vendorProfile.id,
    path: `/api/partner/v1/bookings/${id}/hold/renew`,
    body,
    status: 200,
    transactionId: id,
    run: (idempotencyKey) => renewPartnerHold({ vendorProfile, apiKey }, id, input, idempotencyKey),
  })
})
