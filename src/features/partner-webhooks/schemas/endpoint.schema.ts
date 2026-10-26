import { z } from "zod"

import { PARTNER_WEBHOOK_EVENT_TYPES } from "@/lib/partner-webhooks/catalogue"
import { PARTNER_WEBHOOK_URL_MAX_LENGTH } from "@/lib/partner-webhooks/endpoint-url"

export const PARTNER_WEBHOOK_DESCRIPTION_MAX = 200

/**
 * `POST /api/partner/v1/webhook-endpoints`. `eventTypes` defaults to the whole
 * catalogue; the URL scheme/host rules are checked separately (422).
 */
export const partnerWebhookEndpointCreateSchema = z.object({
  url: z.string().trim().min(1, "url is required").max(PARTNER_WEBHOOK_URL_MAX_LENGTH),
  description: z.string().trim().max(PARTNER_WEBHOOK_DESCRIPTION_MAX).optional().nullable(),
  eventTypes: z
    .array(z.enum(PARTNER_WEBHOOK_EVENT_TYPES))
    .min(1, "Subscribe to at least one event type")
    .max(PARTNER_WEBHOOK_EVENT_TYPES.length * 2)
    .optional()
    .transform((types) =>
      types ? PARTNER_WEBHOOK_EVENT_TYPES.filter((type) => types.includes(type)) : [...PARTNER_WEBHOOK_EVENT_TYPES]
    ),
})

export type PartnerWebhookEndpointCreateInput = z.output<typeof partnerWebhookEndpointCreateSchema>
