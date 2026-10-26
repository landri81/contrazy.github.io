import { TransactionEventType } from "@prisma/client"
import { describe, expect, it } from "vitest"

import {
  getPartnerWebhookEventType,
  ONCE_PER_BOOKING_WEBHOOK_EVENTS,
  TRANSACTION_EVENT_TO_PARTNER_WEBHOOK,
} from "@/features/partner-webhooks/event-mapping"
import {
  isPartnerWebhookEventType,
  PARTNER_WEBHOOK_API_VERSION,
  PARTNER_WEBHOOK_EVENT_TYPES,
} from "@/lib/partner-webhooks/catalogue"

/**
 * The full expected table. Written out by hand on purpose: changing the
 * mapping (or adding an enum value) must be a deliberate edit here too.
 */
const EXPECTED: Record<TransactionEventType, string | null> = {
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
  SIGNATURE_COMPLETED: "booking.contract_signed",
  SIGNED_PDF_GENERATED: null,
  PAYMENT_SESSION_CREATED: null,
  SERVICE_PAYMENT_REQUESTED: null,
  SERVICE_PAYMENT_SUCCEEDED: "booking.payment_succeeded",
  DEPOSIT_AUTHORIZED: "booking.hold_authorized",
  DEPOSIT_CAPTURED: "booking.hold_captured",
  DEPOSIT_RELEASED: "booking.hold_released",
  DISPUTE_OPENED: null,
  TRANSACTION_CANCELLED: "booking.cancelled",
  COMPLETED: "booking.completed",
  EMAIL_SENT: null,
  WEBHOOK_PROCESSED: null,
  CHECK_IN_SUBMITTED: "booking.check_in_submitted",
  CHECK_OUT_REQUESTED: null,
  CHECK_OUT_SUBMITTED: "booking.check_out_submitted",
  DEPOSIT_CHARGED: "booking.hold_authorized",
  DEPOSIT_AUTO_REFUNDED: "booking.hold_released",
  DEPOSIT_AUTO_REFUND_SKIPPED: null,
  DEPOSIT_REFUND_FAILED: null,
  CARD_SECURED: "booking.card_secured",
  CHARGE_SUCCEEDED: "charge.succeeded",
  CHARGE_FAILED: "charge.failed",
  CHARGE_REQUIRES_ACTION: "charge.requires_action",
  REFUND_SUCCEEDED: "refund.succeeded",
}

const ALL_EVENT_TYPES = Object.values(TransactionEventType)

describe("TransactionEventType -> partner webhook mapping", () => {
  it("has an entry for every TransactionEventType in the Prisma enum, and no extra keys", () => {
    expect(Object.keys(TRANSACTION_EVENT_TO_PARTNER_WEBHOOK).sort()).toEqual([...ALL_EVENT_TYPES].sort())
    expect(Object.keys(EXPECTED).sort()).toEqual([...ALL_EVENT_TYPES].sort())
  })

  it.each(ALL_EVENT_TYPES)("maps %s as expected", (type) => {
    expect(getPartnerWebhookEventType(type)).toBe(EXPECTED[type])
  })

  it("only maps to event types from the 2026-11-01 catalogue", () => {
    expect(PARTNER_WEBHOOK_API_VERSION).toBe("2026-11-01")

    for (const mapped of Object.values(TRANSACTION_EVENT_TO_PARTNER_WEBHOOK)) {
      if (mapped !== null) {
        expect(isPartnerWebhookEventType(mapped)).toBe(true)
      }
    }
  })

  it("can emit every catalogue event from at least one timeline event", () => {
    const reachable = new Set(Object.values(TRANSACTION_EVENT_TO_PARTNER_WEBHOOK).filter(Boolean))

    for (const type of PARTNER_WEBHOOK_EVENT_TYPES) {
      expect(reachable.has(type), `${type} has no source TransactionEventType`).toBe(true)
    }
  })

  it("covers every event listed in BACKLOG C3 (ping is test-only, never subscribable)", () => {
    expect([...PARTNER_WEBHOOK_EVENT_TYPES].sort()).toEqual(
      [
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
      ].sort()
    )
    expect(isPartnerWebhookEventType("ping")).toBe(false)
  })

  it("keeps internal events (emails, Stripe bookkeeping, snapshots) away from partners", () => {
    for (const type of ["EMAIL_SENT", "WEBHOOK_PROCESSED", "KYC_STARTED", "SIGNED_PDF_GENERATED", "DISPUTE_OPENED"] as const) {
      expect(getPartnerWebhookEventType(type)).toBeNull()
    }
  })

  it("sends created, cancelled and completed at most once per booking", () => {
    expect([...ONCE_PER_BOOKING_WEBHOOK_EVENTS].sort()).toEqual(["booking.cancelled", "booking.completed", "booking.created"])
  })
})
