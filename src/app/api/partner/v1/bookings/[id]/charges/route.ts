import { createPartnerCharge, partnerChargeCreateSchema } from "@/features/partner-api/server/partner-charges"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { runIdempotentPartnerPost } from "@/lib/partner-api/idempotent-post"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Charges the card saved on the booking (scope `charges:write`,
 * `Idempotency-Key` required): `{ type, amount, description?, proofUrls?,
 * externalRef? }`. 409 `card_not_secured` / `charge_window_closed`, 422
 * `proof_required` for fps / toll / towing without proofUrls.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "charges:write", { requestId })
  const { id } = await params
  const body = await readPartnerJsonBody(request)
  const input = parsePartnerBody(partnerChargeCreateSchema, body)

  return runIdempotentPartnerPost(request, {
    vendorId: vendorProfile.id,
    path: `/api/partner/v1/bookings/${id}/charges`,
    body,
    status: 201,
    transactionId: id,
    run: () => createPartnerCharge({ vendorProfile, apiKey }, id, input),
  })
})
