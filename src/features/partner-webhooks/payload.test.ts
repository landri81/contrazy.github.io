import { describe, expect, it } from "vitest"

import { buildPartnerBookingRecord, PII_SENTINEL } from "@/features/partner-webhooks/__fixtures__/partner-booking"
import {
  buildPartnerBookingSummary,
  buildPartnerPingPayload,
  buildPartnerReportUrl,
  buildPartnerWebhookPayload,
  type PartnerWebhookSourceEvent,
} from "@/features/partner-webhooks/payload"
import {
  PARTNER_WEBHOOK_API_VERSION,
  PARTNER_WEBHOOK_EVENT_TYPES,
  type PartnerWebhookSubscribableEventType,
} from "@/lib/partner-webhooks/catalogue"

const BASE_URL = "https://app.contrazy.test"
const OCCURRED_AT = new Date("2026-11-08T18:06:00.000Z")

/** Metadata stuffed with card/Stripe data; only allow-listed scalars may come out. */
const HOSTILE_METADATA = {
  chargeId: "chg_1",
  refundId: "ref_1",
  externalRef: "LOCAZ-CHG-7",
  type: "FUEL",
  amount: 4_500,
  currency: "EUR",
  status: "succeeded",
  attempt: 1,
  reason: "Fuel not refilled",
  usage: "off_session",
  cardLast4: `${PII_SENTINEL}-4242`,
  cardBrand: `${PII_SENTINEL}-visa`,
  paymentMethodId: `pm_${PII_SENTINEL}`,
  paymentIntentId: `pi_${PII_SENTINEL}`,
  customerPhone: `${PII_SENTINEL}-phone`,
  card: { number: `${PII_SENTINEL}4242424242424242`, cvc: `${PII_SENTINEL}123` },
  declineCode: { nested: `${PII_SENTINEL}-object-values-are-dropped` },
}

function eventFor(type: string, metadata: Record<string, unknown> = HOSTILE_METADATA): PartnerWebhookSourceEvent {
  return { type, occurredAt: OCCURRED_AT, metadata: metadata as PartnerWebhookSourceEvent["metadata"] }
}

function build(type: PartnerWebhookSubscribableEventType, sourceType = "COMPLETED", metadata?: Record<string, unknown>) {
  return buildPartnerWebhookPayload({
    eventId: "evt_0123456789abcdef0123456789abcdef",
    type,
    booking: buildPartnerBookingRecord(),
    event: eventFor(sourceType, metadata),
    baseUrl: BASE_URL,
  })
}

describe("partner webhook payload", () => {
  it.each(PARTNER_WEBHOOK_EVENT_TYPES)("%s has the documented envelope and booking summary", (type) => {
    const payload = build(type)

    expect(Object.keys(payload).sort()).toEqual(["apiVersion", "createdAt", "data", "id", "type"])
    expect(payload).toMatchObject({
      id: expect.stringMatching(/^evt_[0-9a-f]{32}$/),
      type,
      apiVersion: PARTNER_WEBHOOK_API_VERSION,
      createdAt: OCCURRED_AT.toISOString(),
    })

    const booking = payload.data.booking as Record<string, unknown>
    expect(Object.keys(booking).sort()).toEqual(["externalRef", "id", "reference", "status", "steps"])
    expect(booking).toMatchObject({
      id: "txn_partner_1",
      externalRef: "LOCAZ-BK-42",
      reference: "CZ-2026-0001",
      status: "in_progress",
    })
    expect(Array.isArray(booking.steps)).toBe(true)
  })

  it.each(PARTNER_WEBHOOK_EVENT_TYPES)("%s carries no PII beyond the customer's name and email", (type) => {
    const payload = build(type)
    const json = JSON.stringify(payload)

    expect(json).not.toContain(PII_SENTINEL)
    expect(payload.data.customer).toEqual({
      firstName: "Camille",
      lastName: "Martin",
      email: "camille.martin@example.com",
    })
    // No field carries card data, Stripe ids, ID documents, selfies or signatures either
    // ("selfie" and "documents" may only appear as step names, never as keys; the one
    // exception is the identity events' `selfie: { required, status }` summary).
    expect(json).not.toMatch(
      /"(phone|address|birthDate|birthCity|signatureDataUrl|ipAddress|stripeIntentId|paymentMethodId|cardLast4|selfie\w+|documents?\w*|kyc\w*)":/i
    )
    expect(json).not.toMatch(/selfie_|selfieErrorCode|selfieCheck/)

    if (type === "booking.identity_verified" || type === "booking.identity_failed") {
      expect(Object.keys(payload.data.selfie as object).sort()).toEqual(["required", "status"])
    } else {
      expect(payload.data).not.toHaveProperty("selfie")
    }
    expect(json).not.toMatch(/\b(pi|pm|vs|seti|cus)_[A-Za-z0-9]/)
  })

  it("sends null for the customer when the booking has no client profile", () => {
    const payload = buildPartnerWebhookPayload({
      eventId: "evt_x",
      type: "booking.created",
      booking: buildPartnerBookingRecord({ clientProfile: null }),
      event: eventFor("LINK_CREATED", {}),
      baseUrl: BASE_URL,
    })

    expect(payload.data.customer).toBeNull()
  })

  it("booking.contract_signed carries the protected signed PDF URL", () => {
    const payload = build("booking.contract_signed", "SIGNATURE_COMPLETED", {})
    const contract = payload.data.contract as { signedAt: string; signedPdfUrl: string }

    expect(contract.signedAt).toBe("2026-11-01T08:21:00.000Z")
    expect(contract.signedPdfUrl).toEqual(expect.any(String))
    expect(contract.signedPdfUrl.startsWith(BASE_URL) || contract.signedPdfUrl.startsWith("https://res.cloudinary.com/")).toBe(true)
  })

  it("booking.check_out_submitted carries km, fuel, photos count and the report URL", () => {
    const payload = build("booking.check_out_submitted", "CHECK_OUT_SUBMITTED", {})

    expect(payload.data.checkOut).toEqual({
      submittedAt: "2026-11-08T18:05:00.000Z",
      km: 12_480.5,
      fuel: "3/4",
      photosCount: 3,
      reportUrl: `${BASE_URL}/api/partner/v1/bookings/txn_partner_1/reports/check-out`,
    })
    // Free-text answers (damage notes) and photo URLs are not copied into the payload.
    expect(JSON.stringify(payload)).not.toContain("scratch on door")
  })

  it("booking.check_in_submitted without a submitted report sends empty facts, not errors", () => {
    const payload = build("booking.check_in_submitted", "CHECK_IN_SUBMITTED", {})

    expect(payload.data.checkIn).toEqual({ submittedAt: null, km: null, fuel: null, photosCount: 0, reportUrl: null })
  })

  it("hold events carry the deposit state without Stripe ids", () => {
    const payload = build("booking.hold_authorized", "DEPOSIT_AUTHORIZED", {})

    expect(payload.data.hold).toEqual({
      status: "authorized",
      strategy: "authorization_hold",
      amount: 80_000,
      currency: "EUR",
      authorizedAt: "2026-11-01T08:31:00.000Z",
      capturedAt: null,
      capturedAmount: null,
      releasedAt: null,
      releasedAmount: null,
    })
  })

  it.each(["charge.succeeded", "charge.failed", "charge.requires_action"] as const)(
    "%s copies only allow-listed scalar charge facts from the event metadata",
    (type) => {
      const payload = build(type, "CHARGE_SUCCEEDED")

      expect(payload.data.charge).toEqual({
        chargeId: "chg_1",
        externalRef: "LOCAZ-CHG-7",
        type: "FUEL",
        amount: 4_500,
        currency: "EUR",
        status: "succeeded",
        attempt: 1,
      })
    }
  )

  it("refund.succeeded copies only allow-listed refund facts", () => {
    const payload = build("refund.succeeded", "REFUND_SUCCEEDED")

    expect(payload.data.refund).toEqual({
      refundId: "ref_1",
      chargeId: "chg_1",
      amount: 4_500,
      currency: "EUR",
      reason: "Fuel not refilled",
    })
  })

  it.each(["dispute.opened", "dispute.updated", "dispute.closed"] as const)("%s carries the dispute summary and the evidence link, never Stripe ids or notes (C8)", (type) => {
    const dispute = {
      id: "dsp_1",
      transactionId: "txn_1",
      status: type === "dispute.closed" ? "LOST" : "UNDER_REVIEW",
      kind: "CHARGEBACK",
      summary: `${PII_SENTINEL} summary`,
      evidenceImages: [{ assetUrl: `https://res.cloudinary.com/${PII_SENTINEL}.jpg` }],
      resolution: `${PII_SENTINEL} admin note`,
      resolvedByAdminId: `${PII_SENTINEL}-admin`,
      reason: "fraudulent",
      amount: 15_000,
      currency: "eur",
      evidenceDueBy: new Date("2026-12-01T23:59:59.000Z"),
      stripeDisputeId: `dp_${PII_SENTINEL}`,
      openedAt: new Date("2026-11-20T10:00:00.000Z"),
      resolvedAt: type === "dispute.closed" ? new Date("2026-12-10T09:00:00.000Z") : null,
    }
    const booking = buildPartnerBookingRecord({ dispute } as never)
    const payload = buildPartnerWebhookPayload({ eventId: "evt_dispute", type, booking, event: eventFor("DISPUTE_UPDATED", { resolutionNote: `${PII_SENTINEL} note` }), baseUrl: BASE_URL })

    expect(payload.data.dispute).toEqual({
      id: "dsp_1",
      kind: "chargeback",
      status: type === "dispute.closed" ? "lost" : "under_review",
      reason: "fraudulent",
      amount: 15_000,
      currency: "eur",
      openedAt: "2026-11-20T10:00:00.000Z",
      evidenceDueBy: "2026-12-01T23:59:59.000Z",
      closedAt: type === "dispute.closed" ? "2026-12-10T09:00:00.000Z" : null,
      evidenceUrl: `${BASE_URL}/${booking.locale === "fr" ? "fr" : "en"}/vendor/transactions/${booking.id}`,
    })
    expect(JSON.stringify(payload)).not.toContain(PII_SENTINEL)
  })

  it("a damage claim the vendor won reads as won, and a booking without a dispute sends null", () => {
    const claim = { id: "dsp_2", transactionId: "txn_1", status: "RESOLVED", kind: "DAMAGE_CLAIM", summary: "", evidenceImages: [], resolution: null, resolvedByAdminId: null, reason: null, amount: null, currency: null, evidenceDueBy: null, stripeDisputeId: null, openedAt: new Date("2026-11-20T10:00:00.000Z"), resolvedAt: new Date("2026-11-22T10:00:00.000Z") }
    expect(buildPartnerWebhookPayload({ eventId: "evt_claim", type: "dispute.closed", booking: buildPartnerBookingRecord({ dispute: claim } as never), event: eventFor("DISPUTE_CLOSED", {}), baseUrl: BASE_URL }).data.dispute).toMatchObject({ kind: "damage_claim", status: "won", reason: null, amount: null })
    expect(build("dispute.opened", "DISPUTE_OPENED", {}).data.dispute).toBeNull()
  })

  it("booking.card_secured says when, never which card", () => {
    const payload = build("booking.card_secured", "CARD_SECURED")

    expect(payload.data.card).toEqual({ securedAt: OCCURRED_AT.toISOString(), usage: "off_session" })
  })

  it("booking.cancelled reports who cancelled", () => {
    const payload = build("booking.cancelled", "LINK_CANCELLED", { actor: "CLIENT" })

    expect(payload.data.cancellation).toEqual({ cancelledAt: OCCURRED_AT.toISOString(), cancelledBy: "client", reason: null })
    expect(build("booking.cancelled", "TRANSACTION_CANCELLED", {}).data.cancellation).toMatchObject({ cancelledBy: "vendor" })
  })

  it("ping carries only the endpoint id", () => {
    const createdAt = new Date("2026-11-02T10:00:00.000Z")

    expect(buildPartnerPingPayload({ eventId: "evt_ping", endpointId: "we_1", createdAt })).toEqual({
      id: "evt_ping",
      type: "ping",
      apiVersion: "2026-11-01",
      createdAt: "2026-11-02T10:00:00.000Z",
      data: { endpoint: { id: "we_1" } },
    })
  })

  it("builds report URLs under the partner API", () => {
    expect(buildPartnerReportUrl("txn 1", "CHECK_IN", `${BASE_URL}/`)).toBe(
      `${BASE_URL}/api/partner/v1/bookings/txn%201/reports/check-in`
    )
  })

  it("lists only enabled steps as required in the booking summary", () => {
    const summary = buildPartnerBookingSummary(buildPartnerBookingRecord())
    const byKey = Object.fromEntries(summary.steps.map((step) => [step.key, step]))

    expect(byKey.identity).toMatchObject({ required: true, status: "done" })
    expect(byKey.selfie).toMatchObject({ required: false, status: "skipped" })
    expect(byKey.contract).toMatchObject({ required: true, status: "done" })
  })
})

describe("partner webhook selfie summary (C4)", () => {
  const selfieBooking = (selfieCheck: string, status = "VERIFIED", selfieErrorCode: string | null = null) =>
    buildPartnerBookingRecord({
      requireSelfie: true,
      stepSwitches: { ...(buildPartnerBookingRecord().stepSwitches as object), selfie: true },
      kycVerification: {
        ...buildPartnerBookingRecord().kycVerification!,
        status: status as "VERIFIED",
        selfieCheck: selfieCheck as "VERIFIED",
        selfieErrorCode,
      },
    })

  function identityPayload(type: "booking.identity_verified" | "booking.identity_failed", booking = selfieBooking("VERIFIED")) {
    return buildPartnerWebhookPayload({
      eventId: "evt_selfie",
      type,
      booking,
      event: eventFor(type === "booking.identity_verified" ? "KYC_VERIFIED" : "KYC_FAILED", {}),
      baseUrl: BASE_URL,
    })
  }

  it("identity_verified reports a matched selfie when one was required", () => {
    const payload = identityPayload("booking.identity_verified")
    const steps = (payload.data.booking as { steps: Array<{ key: string; status: string; required: boolean }> }).steps

    expect(payload.data.selfie).toEqual({ required: true, status: "verified" })
    expect(steps.find((step) => step.key === "selfie")).toMatchObject({ required: true, status: "done" })
  })

  it("identity_failed reports an unmatched selfie without the Stripe error code or any biometric data", () => {
    const payload = identityPayload(
      "booking.identity_failed",
      selfieBooking("UNVERIFIED", "FAILED", "selfie_face_mismatch")
    )
    const json = JSON.stringify(payload)
    const steps = (payload.data.booking as { steps: Array<{ key: string; status: string }> }).steps

    expect(payload.data.selfie).toEqual({ required: true, status: "unverified" })
    expect(steps.find((step) => step.key === "selfie")).toMatchObject({ status: "pending" })
    expect(json).not.toContain("selfie_face_mismatch")
    expect(json).not.toContain(PII_SENTINEL)
  })

  it("says pending while a required selfie has no outcome yet, and not_requested when it was not asked for", () => {
    expect(identityPayload("booking.identity_failed", selfieBooking("NOT_REQUESTED", "FAILED")).data.selfie).toEqual({
      required: true,
      status: "pending",
    })
    expect(identityPayload("booking.identity_verified", buildPartnerBookingRecord()).data.selfie).toEqual({
      required: false,
      status: "not_requested",
    })
  })
})
