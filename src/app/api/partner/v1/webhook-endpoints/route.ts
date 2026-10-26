import { NextResponse } from "next/server"

import { partnerWebhookEndpointCreateSchema } from "@/features/partner-webhooks/schemas/endpoint.schema"
import {
  createPartnerWebhookEndpoint,
  listPartnerWebhookEndpoints,
} from "@/features/partner-webhooks/server/endpoints"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { withPartnerApi } from "@/lib/partner-api/errors"
import { parsePartnerBody, readPartnerJsonBody } from "@/lib/partner-api/request"

export const dynamic = "force-dynamic"

/**
 * Registers a webhook endpoint (scope `webhooks:write`). The response carries
 * the `whsec_` signing secret; it is shown once and cannot be read again.
 */
export const POST = withPartnerApi(async (request, { requestId }) => {
  const { vendorProfile, apiKey } = await requirePartnerApiKey(request, "webhooks:write", { requestId })
  const input = parsePartnerBody(partnerWebhookEndpointCreateSchema, await readPartnerJsonBody(request))
  const endpoint = await createPartnerWebhookEndpoint(
    { vendorId: vendorProfile.id, apiKeyId: apiKey.id, apiKeyPrefix: apiKey.prefix, requestId },
    input
  )

  return NextResponse.json(endpoint, { status: 201, headers: { "Cache-Control": "no-store" } })
})

/** Lists this vendor's endpoints, newest first, without secrets (scope `webhooks:write`). */
export const GET = withPartnerApi(async (request, { requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "webhooks:write", { requestId })

  return NextResponse.json(await listPartnerWebhookEndpoints(vendorProfile.id))
})
