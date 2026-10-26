import { NextResponse } from "next/server"

import { sendPartnerWebhookTestPing } from "@/features/partner-webhooks/server/endpoints"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Sends a signed `ping` event to the endpoint now (scope `webhooks:write`) and
 * returns the delivery: status, HTTP status and the first 1 KB of the reply.
 */
export const POST = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "webhooks:write", { requestId })
  const { id } = await params

  return NextResponse.json(
    await sendPartnerWebhookTestPing(
      { vendorId: vendorProfile.id, apiKeyId: apiKey.id, apiKeyPrefix: apiKey.prefix, requestId },
      id
    )
  )
})
