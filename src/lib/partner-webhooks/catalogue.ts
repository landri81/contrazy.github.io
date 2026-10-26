// Client-safe: no Node-only imports, so dashboard components can use the catalogue.

/** Version of the webhook payload contract; sent as `apiVersion` and `Contrazy-Api-Version`. */
export const PARTNER_WEBHOOK_API_VERSION = "2026-11-01"

/**
 * Every event a partner endpoint can subscribe to (catalogue `2026-11-01`).
 * `ping` is sent only by `POST /webhook-endpoints/:id/test` and cannot be
 * subscribed to.
 */
export const PARTNER_WEBHOOK_EVENT_TYPES = [
  "booking.created",
  "booking.link_opened",
  "booking.profile_submitted",
  "booking.documents_submitted",
  "booking.identity_verified",
  "booking.identity_failed",
  "booking.contract_signed",
  "booking.payment_succeeded",
  "booking.card_secured",
  "booking.hold_authorized",
  "booking.hold_captured",
  "booking.hold_released",
  "booking.check_in_submitted",
  "booking.check_out_submitted",
  "booking.completed",
  "booking.cancelled",
  "charge.succeeded",
  "charge.failed",
  "charge.requires_action",
  "refund.succeeded",
] as const

export type PartnerWebhookSubscribableEventType = (typeof PARTNER_WEBHOOK_EVENT_TYPES)[number]

export const PARTNER_WEBHOOK_PING_EVENT = "ping" as const

export type PartnerWebhookEventType = PartnerWebhookSubscribableEventType | typeof PARTNER_WEBHOOK_PING_EVENT

export function isPartnerWebhookEventType(value: unknown): value is PartnerWebhookSubscribableEventType {
  return typeof value === "string" && (PARTNER_WEBHOOK_EVENT_TYPES as readonly string[]).includes(value)
}

/** Keeps catalogue order and drops duplicates, so stored lists are stable. */
export function normalizePartnerWebhookEventTypes(eventTypes: readonly string[]) {
  return PARTNER_WEBHOOK_EVENT_TYPES.filter((type) => eventTypes.includes(type))
}
