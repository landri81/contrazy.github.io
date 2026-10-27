import { NextResponse } from "next/server"

import { partnerCheckoutDocumentsSubmitSchema } from "@/features/partner-api/schemas/checkout.schema"
import { submitPartnerCheckoutDocuments } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * The documents step of the embedded checkout (scope `bookings:write`): `{ files: [{ requirementId, slotIndex, fileId }] }`,
 * every file at once, as Contrazy's page submits them (submitting again replaces them). Answers the checkout state.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerCheckoutDocumentsSubmitSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await submitPartnerCheckoutDocuments({ vendorProfile }, id, input))
})
