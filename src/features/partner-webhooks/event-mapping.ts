import type { TransactionEventType } from "@prisma/client"

import type { PartnerWebhookSubscribableEventType } from "@/lib/partner-webhooks/catalogue"

/**
 * The one mapping from timeline events to partner webhook events. Every
 * `TransactionEventType` is listed (the `Record` type enforces it), so a new
 * event type cannot be added without deciding whether partners hear about it.
 * `null` = internal event, never sent.
 */
export const TRANSACTION_EVENT_TO_PARTNER_WEBHOOK: Record<TransactionEventType, PartnerWebhookSubscribableEventType | null> = {
  LINK_CREATED: "booking.created",
  TRANSACTION_RECREATED: null,
  LINK_OPENED: "booking.link_opened",
  LINK_UPDATED: null,
  LINK_CANCELLED: "booking.cancelled",
  CONTRACT_SNAPSHOT_CREATED: null,
  PROFILE_SUBMITTED: "booking.profile_submitted",
  DOCUMENTS_SUBMITTED: "booking.documents_submitted",
  CUSTOM_FIELDS_SUBMITTED: null,
  KYC_STARTED: null,
  KYC_VERIFIED: "booking.identity_verified",
  KYC_FAILED: "booking.identity_failed",
  CONTRACT_REVIEWED: null,
  // Recorded once the signature and the signed PDF are both stored, so the URL is available.
  SIGNATURE_COMPLETED: "booking.contract_signed",
  SIGNED_PDF_GENERATED: null,
  PAYMENT_SESSION_CREATED: null,
  SERVICE_PAYMENT_REQUESTED: null,
  SERVICE_PAYMENT_SUCCEEDED: "booking.payment_succeeded",
  DEPOSIT_AUTHORIZED: "booking.hold_authorized",
  DEPOSIT_CAPTURED: "booking.hold_captured",
  DEPOSIT_RELEASED: "booking.hold_released",
  // Damage claims and chargebacks (C8): a summary only, never the evidence itself.
  DISPUTE_OPENED: "dispute.opened",
  DISPUTE_UPDATED: "dispute.updated",
  DISPUTE_CLOSED: "dispute.closed",
  // Vendor-side cancellation; customer/partner/expiry cancellations arrive as LINK_CANCELLED.
  TRANSACTION_CANCELLED: "booking.cancelled",
  COMPLETED: "booking.completed",
  EMAIL_SENT: null,
  WEBHOOK_PROCESSED: null,
  CHECK_IN_SUBMITTED: "booking.check_in_submitted",
  CHECK_OUT_REQUESTED: null,
  CHECK_OUT_SUBMITTED: "booking.check_out_submitted",
  // "Charge and refund" deposit strategy: the deposit is secured by an immediate charge.
  DEPOSIT_CHARGED: "booking.hold_authorized",
  DEPOSIT_AUTO_REFUNDED: "booking.hold_released",
  DEPOSIT_AUTO_REFUND_SKIPPED: null,
  DEPOSIT_REFUND_FAILED: null,
  // Recorded only through server/charge-events.ts (card-security step and off-session charges, C5/C6).
  CARD_SECURED: "booking.card_secured",
  CHARGE_SUCCEEDED: "charge.succeeded",
  CHARGE_FAILED: "charge.failed",
  CHARGE_REQUIRES_ACTION: "charge.requires_action",
  REFUND_SUCCEEDED: "refund.succeeded",
}

/**
 * Events sent at most once per booking whatever the number of timeline rows
 * behind them (a vendor cancel records both TRANSACTION_CANCELLED and
 * LINK_CANCELLED).
 */
export const ONCE_PER_BOOKING_WEBHOOK_EVENTS = new Set<PartnerWebhookSubscribableEventType>([
  "booking.created",
  "booking.cancelled",
  "booking.completed",
])

export function getPartnerWebhookEventType(type: TransactionEventType) {
  return TRANSACTION_EVENT_TO_PARTNER_WEBHOOK[type] ?? null
}
