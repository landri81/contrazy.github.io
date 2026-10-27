import { NextResponse } from "next/server"

import { uploadPartnerCheckoutFile } from "@/features/partner-api/server/partner-checkout"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { PartnerApiError, withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

/**
 * One document of the embedded checkout (scope `bookings:write`): multipart `requirementId`, `slotIndex`, `file`
 * (JPEG, PNG, WebP, HEIC or PDF, 10 MB). Answers the signed `fileId` to send with the documents step.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:write", { requestId })
  const { id } = await params
  const form = await request.formData().catch(() => {
    throw new PartnerApiError("invalid_request", "Send the document as multipart/form-data.")
  })

  return NextResponse.json(await uploadPartnerCheckoutFile({ vendorProfile }, id, form), { status: 201 })
})
