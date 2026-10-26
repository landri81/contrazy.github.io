import { NextResponse } from "next/server"

import { deletePartnerWebhookEndpoint } from "@/features/partner-webhooks/server/endpoints"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"

/** Deletes an endpoint (scope `webhooks:write`); queued deliveries stop. Another vendor's endpoint is 404. */
export const DELETE = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "webhooks:write", { requestId })
  const { id } = await params

  return NextResponse.json(
    await deletePartnerWebhookEndpoint(
      { vendorId: vendorProfile.id, apiKeyId: apiKey.id, apiKeyPrefix: apiKey.prefix, requestId },
      id
    )
  )
})
