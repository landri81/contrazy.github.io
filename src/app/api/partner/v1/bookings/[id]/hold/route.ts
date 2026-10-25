import { createPartnerHold, partnerHoldCreateSchema } from "@/features/partner-api/server/partner-holds"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { runIdempotentPartnerPost } from "@/lib/partner-api/idempotent-post"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Places the pickup hold on the card saved at booking (scope `bookings:write`,
 * `Idempotency-Key` required): `{ amount, force? }`. 409 `hold_not_recommended`
 * for rentals over 6 days unless `force: true`; 402 `hold_failed` when the card
 * is declined or needs the customer (no off-session retry).
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const body = await readPartnerJsonBody(request)
  const input = parsePartnerBody(partnerHoldCreateSchema, body)

  return runIdempotentPartnerPost(request, {
    vendorId: vendorProfile.id,
    path: `/api/partner/v1/bookings/${id}/hold`,
    body,
    status: 201,
    transactionId: id,
    run: (idempotencyKey) => createPartnerHold({ vendorProfile, apiKey }, id, input, idempotencyKey),
  })
})
