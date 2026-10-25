import type { Prisma } from "@prisma/client"

import { buildBookingStepProgress, type PartnerBookingRecord } from "@/features/partner-api/booking-presenter"
import { parseStepSwitches } from "@/features/transactions/step-switches"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import {
  PARTNER_WEBHOOK_API_VERSION,
  type PartnerWebhookEventType,
  type PartnerWebhookSubscribableEventType,
} from "@/lib/partner-webhooks/catalogue"

/**
 * Builds partner webhook payloads. Only what a partner needs to move its own
 * booking forward goes out: booking identifiers, status and step progress,
 * the customer's name and email, and per-event facts. Never ID documents,
 * selfies, KYC details, phone/address/birth data, card data or Stripe ids.
 * Identity events only say whether a selfie match was required and its
 * outcome (`selfie: { required, status }`), never the image or a score.
 */

export type PartnerWebhookPayload = {
  id: string
  type: PartnerWebhookEventType
  apiVersion: typeof PARTNER_WEBHOOK_API_VERSION
  createdAt: string
  data: Record<string, unknown>
}

export type PartnerWebhookSourceEvent = {
  type: string
  occurredAt: Date
  metadata: Prisma.JsonValue | null
}

type ReportType = "CHECK_IN" | "CHECK_OUT"

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function readMetadata(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Copies only the listed keys, and only scalar values, from event metadata. */
function pickScalars(source: Record<string, unknown>, keys: readonly string[]) {
  const picked: Record<string, string | number | boolean | null> = {}

  for (const key of keys) {
    const value = source[key]

    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      picked[key] = value
    }
  }

  return picked
}

export function buildPartnerReportUrl(bookingId: string, type: ReportType, baseUrl: string) {
  const slug = type === "CHECK_IN" ? "check-in" : "check-out"
  return `${baseUrl.replace(/\/$/, "")}/api/partner/v1/bookings/${encodeURIComponent(bookingId)}/reports/${slug}`
}

const KM_LABEL = /\b(km|kilom|mileage|odometer|compteur)/i
const FUEL_LABEL = /(fuel|carburant|essence|charge|battery|batterie)/i

function readReportValue(booking: PartnerBookingRecord, type: ReportType, fieldType: string, label: RegExp) {
  const report = booking.reports.find((item) => item.type === type)

  if (!report) {
    return null
  }

  const fields = booking.reportFields.filter((field) => field.reportType === type && field.fieldType === fieldType)
  const field = fields.find((item) => label.test(item.label)) ?? fields[0]
  const value = field ? report.responses.find((response) => response.fieldId === field.id)?.value?.trim() : undefined

  return value ? value : null
}

function buildReportFacts(booking: PartnerBookingRecord, type: ReportType, baseUrl: string) {
  const report = booking.reports.find((item) => item.type === type) ?? null
  const rawKm = readReportValue(booking, type, "NUMBER", KM_LABEL)
  // Customers type "12 480,5" as well as "12480.5": drop digit grouping (\s covers NBSP), accept a decimal comma.
  const normalizedKm = rawKm?.replace(/\s/g, "").replace(",", ".") ?? ""
  const km = normalizedKm && Number.isFinite(Number(normalizedKm)) ? Number(normalizedKm) : null

  return {
    submittedAt: iso(report?.submittedAt),
    km,
    fuel: readReportValue(booking, type, "SELECT", FUEL_LABEL),
    photosCount: report?.assets.length ?? 0,
    reportUrl: report ? buildPartnerReportUrl(booking.id, type, baseUrl) : null,
  }
}

/** The booking's deposit hold as partners see it (webhooks and the hold endpoints, C5b). */
export function buildHold(booking: Pick<PartnerBookingRecord, "depositAuthorization">) {
  const deposit = booking.depositAuthorization

  if (!deposit) {
    return null
  }

  return {
    status: deposit.status.toLowerCase(),
    strategy: deposit.depositStrategy === "CHARGE_REFUND" ? "charge_refund" : "authorization_hold",
    amount: deposit.amount,
    currency: deposit.currency,
    authorizedAt: iso(deposit.authorizedAt ?? deposit.depositChargedAt),
    capturedAt: iso(deposit.capturedAt),
    capturedAmount: deposit.depositCapturedAmount,
    releasedAt: iso(deposit.releasedAt ?? deposit.depositRefundedAt),
    releasedAmount: deposit.depositRefundedAmount,
  }
}

export type PartnerSelfieStatus = "not_requested" | "pending" | "verified" | "unverified"

/** Selfie outcome for identity events: a status word only, no biometric or ID data. */
export function buildPartnerSelfieSummary(
  booking: Pick<PartnerBookingRecord, "requireSelfie" | "kycVerification">
): { required: boolean; status: PartnerSelfieStatus } {
  if (!booking.requireSelfie) {
    return { required: false, status: "not_requested" }
  }

  switch (booking.kycVerification?.selfieCheck) {
    case "VERIFIED":
      return { required: true, status: "verified" }
    case "UNVERIFIED":
      return { required: true, status: "unverified" }
    default:
      return { required: true, status: "pending" }
  }
}

function buildEventData(
  type: PartnerWebhookSubscribableEventType,
  booking: PartnerBookingRecord,
  event: PartnerWebhookSourceEvent,
  baseUrl: string
): Record<string, unknown> {
  const metadata = readMetadata(event.metadata)

  switch (type) {
    case "booking.created":
      return {
        schedule: { startAt: iso(booking.startAt), endAt: iso(booking.endAt), timezone: booking.timezone },
      }
    case "booking.link_opened":
      return { link: { openedAt: iso(booking.link?.openedAt ?? event.occurredAt) } }
    case "booking.identity_verified":
      return {
        identity: { status: "verified", verifiedAt: iso(booking.kycVerification?.verifiedAt ?? event.occurredAt) },
        selfie: buildPartnerSelfieSummary(booking),
      }
    case "booking.identity_failed":
      return {
        identity: { status: "failed", failedAt: iso(event.occurredAt) },
        selfie: buildPartnerSelfieSummary(booking),
      }
    case "booking.contract_signed": {
      const signedPdfUrl = booking.contractArtifact?.signedPdfUrl
      return {
        contract: {
          signedAt: iso(booking.contractArtifact?.signedAt ?? booking.signatureRecord?.signedAt ?? event.occurredAt),
          signedPdfUrl: signedPdfUrl
            ? resolveDocumentAssetUrl(signedPdfUrl, `${booking.reference}-signed.pdf`, baseUrl)
            : null,
        },
      }
    }
    case "booking.payment_succeeded": {
      const payment = booking.payments.find((item) => item.kind === "SERVICE_PAYMENT") ?? null
      return {
        payment: {
          amount: payment?.amount ?? booking.amount,
          currency: payment?.currency ?? booking.currency,
          paidAt: iso(payment?.processedAt ?? event.occurredAt),
        },
      }
    }
    case "booking.hold_authorized":
    case "booking.hold_captured":
    case "booking.hold_released":
      return { hold: buildHold(booking) }
    case "booking.check_in_submitted":
      return { checkIn: buildReportFacts(booking, "CHECK_IN", baseUrl) }
    case "booking.check_out_submitted":
      return { checkOut: buildReportFacts(booking, "CHECK_OUT", baseUrl) }
    case "booking.completed":
      return { completion: { completedAt: iso(booking.customerCompletedAt ?? event.occurredAt) } }
    case "booking.cancelled": {
      const actor = typeof metadata.actor === "string" ? metadata.actor : booking.link?.cancelledBy ?? null
      return {
        cancellation: {
          cancelledAt: iso(booking.link?.cancelledAt ?? event.occurredAt),
          cancelledBy: actor ? actor.toLowerCase() : event.type === "TRANSACTION_CANCELLED" ? "vendor" : null,
          reason: booking.link?.cancelReason ?? null,
        },
      }
    }
    case "booking.card_secured":
      return { card: { securedAt: iso(event.occurredAt), ...pickScalars(metadata, ["usage"]) } }
    case "charge.succeeded":
    case "charge.failed":
    case "charge.requires_action":
      return {
        charge: pickScalars(metadata, [
          "chargeId",
          "externalRef",
          "type",
          "amount",
          "currency",
          "status",
          "attempt",
          "declineCode",
          "nextRetryAt",
          "paymentLinkUrl",
          "cardUpdateUrl",
        ]),
      }
    case "refund.succeeded":
      return { refund: pickScalars(metadata, ["refundId", "chargeId", "amount", "currency", "reason"]) }
    case "booking.profile_submitted":
    case "booking.documents_submitted":
    default:
      return {}
  }
}

export function buildPartnerBookingSummary(booking: PartnerBookingRecord) {
  const switches = parseStepSwitches(booking.stepSwitches)

  return {
    id: booking.id,
    externalRef: booking.externalRef,
    reference: booking.reference,
    status: booking.status.toLowerCase(),
    steps: switches ? buildBookingStepProgress(switches, booking) : [],
  }
}

export function buildPartnerWebhookPayload(input: {
  eventId: string
  type: PartnerWebhookSubscribableEventType
  booking: PartnerBookingRecord
  event: PartnerWebhookSourceEvent
  baseUrl: string
}): PartnerWebhookPayload {
  const { booking } = input
  const customer = booking.clientProfile

  return {
    id: input.eventId,
    type: input.type,
    apiVersion: PARTNER_WEBHOOK_API_VERSION,
    createdAt: input.event.occurredAt.toISOString(),
    data: {
      booking: buildPartnerBookingSummary(booking),
      customer: customer
        ? { firstName: customer.firstName, lastName: customer.lastName, email: customer.email }
        : null,
      ...buildEventData(input.type, booking, input.event, input.baseUrl),
    },
  }
}

export function buildPartnerPingPayload(input: { eventId: string; endpointId: string; createdAt: Date }): PartnerWebhookPayload {
  return {
    id: input.eventId,
    type: "ping",
    apiVersion: PARTNER_WEBHOOK_API_VERSION,
    createdAt: input.createdAt.toISOString(),
    data: { endpoint: { id: input.endpointId } },
  }
}
