import { NextResponse } from "next/server"

import { partnerDocumentsRejectSchema } from "@/features/partner-api/schemas/checkout.schema"
import { rejectPartnerCheckoutDocuments } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Refuses the documents the customer sent (scope `bookings:write`, LOCAZ T21): `{ reason }`, shown to the customer. The
 * documents step opens again, even after payment, and the checkout answers `documentsRejection` until new documents
 * arrive. Answers the checkout state.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const input = parsePartnerBody(partnerDocumentsRejectSchema, await readPartnerJsonBody(request))

  return NextResponse.json(await rejectPartnerCheckoutDocuments({ vendorProfile }, id, input))
})
