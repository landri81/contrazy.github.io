import type { PostCharge, Prisma } from "@prisma/client"

import { parseRentalDetails } from "@/features/partner-api/schemas/booking.schema"
import { parseStepSwitches, STEP_SWITCH_KEYS, type StepSwitchKey, type StepSwitches } from "@/features/transactions/step-switches"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"

export const partnerBookingInclude = {
  link: true,
  clientProfile: true,
  requirements: { orderBy: { sortOrder: "asc" } },
  reportFields: { orderBy: { sortOrder: "asc" } },
  reports: {
    include: {
      responses: true,
      assets: { orderBy: { sortOrder: "asc" } },
    },
  },
  kycVerification: true,
  signatureRecord: true,
  contractArtifact: true,
  payments: true,
  depositAuthorization: true,
  cardSecurity: true,
  postCharges: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  events: { orderBy: { occurredAt: "asc" } },
} satisfies Prisma.TransactionInclude

export type PartnerBookingRecord = Prisma.TransactionGetPayload<{ include: typeof partnerBookingInclude }>

export type BookingStepStatus = "pending" | "done" | "skipped"

export type BookingStepProgress = {
  key: StepSwitchKey
  required: boolean
  status: BookingStepStatus
  startedAt: string | null
  completedAt: string | null
}

type StepSnapshot = Pick<
  PartnerBookingRecord,
  "kycVerification" | "signatureRecord" | "contractArtifact" | "payments" | "depositAuthorization" | "cardSecurity" | "reports" | "events"
>

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function eventTime(snapshot: StepSnapshot, type: string) {
  const event = [...snapshot.events].reverse().find((item) => item.type === type)
  return event?.occurredAt ?? null
}

function submittedReport(snapshot: StepSnapshot, type: "CHECK_IN" | "CHECK_OUT") {
  return snapshot.reports.find((report) => report.type === type && report.status !== "PENDING") ?? null
}

const AUTHORIZED_DEPOSIT_STATUSES = new Set(["AUTHORIZED", "SUCCEEDED", "CAPTURED", "RELEASED"])

function resolveStep(key: StepSwitchKey, snapshot: StepSnapshot): { done: Date | null; started: Date | null } {
  switch (key) {
    case "identity": {
      const kyc = snapshot.kycVerification
      return {
        started: kyc?.createdAt ?? eventTime(snapshot, "KYC_STARTED"),
        done: kyc?.status === "VERIFIED" ? (kyc.verifiedAt ?? eventTime(snapshot, "KYC_VERIFIED") ?? kyc.createdAt) : null,
      }
    }
    case "documents":
      return { started: null, done: eventTime(snapshot, "DOCUMENTS_SUBMITTED") }
    case "contract": {
      const signed =
        snapshot.signatureRecord?.status === "SIGNED" && Boolean(snapshot.contractArtifact?.signedPdfUrl)
      return {
        started: snapshot.contractArtifact?.reviewCompletedAt ?? null,
        done: signed
          ? (snapshot.contractArtifact?.signedAt ?? snapshot.signatureRecord?.signedAt ?? eventTime(snapshot, "SIGNATURE_COMPLETED"))
          : null,
      }
    }
    case "checkIn": {
      const report = submittedReport(snapshot, "CHECK_IN")
      return { started: null, done: report ? (report.submittedAt ?? report.updatedAt) : null }
    }
    case "checkOut": {
      const report = submittedReport(snapshot, "CHECK_OUT")
      return { started: eventTime(snapshot, "CHECK_OUT_REQUESTED"), done: report ? (report.submittedAt ?? report.updatedAt) : null }
    }
    case "payment": {
      const payment = snapshot.payments.find((item) => item.kind === "SERVICE_PAYMENT")
      return {
        started: eventTime(snapshot, "PAYMENT_SESSION_CREATED") ?? payment?.createdAt ?? null,
        done: payment?.status === "SUCCEEDED" ? (payment.processedAt ?? payment.createdAt) : null,
      }
    }
    case "hold": {
      const deposit = snapshot.depositAuthorization
      return {
        started: null,
        done: deposit && AUTHORIZED_DEPOSIT_STATUSES.has(deposit.status) ? (deposit.authorizedAt ?? eventTime(snapshot, "DEPOSIT_AUTHORIZED")) : null,
      }
    }
    case "selfie": {
      // Captured in the same Stripe Identity session as the ID document.
      const kyc = snapshot.kycVerification
      return {
        started: kyc?.createdAt ?? eventTime(snapshot, "KYC_STARTED"),
        done:
          kyc?.status === "VERIFIED" && kyc.selfieCheck === "VERIFIED"
            ? (kyc.verifiedAt ?? eventTime(snapshot, "KYC_VERIFIED") ?? kyc.createdAt)
            : null,
      }
    }
    case "cardSecurity": {
      // Started when the card form opened (intent created), done once the card is saved with consent.
      const card = snapshot.cardSecurity
      return {
        started: card?.createdAt ?? null,
        done: card?.status === "SECURED" ? (card.securedAt ?? eventTime(snapshot, "CARD_SECURED")) : null,
      }
    }
    default:
      return { started: null, done: null }
  }
}

/** One entry per step switch: skipped when off, done with its timestamp when completed, else pending. */
export function buildBookingStepProgress(switches: StepSwitches, snapshot: StepSnapshot): BookingStepProgress[] {
  return STEP_SWITCH_KEYS.map((key) => {
    if (!switches[key]) {
      return { key, required: false, status: "skipped", startedAt: null, completedAt: null }
    }

    const { started, done } = resolveStep(key, snapshot)

    return {
      key,
      required: true,
      status: done ? "done" : "pending",
      startedAt: iso(started ?? done),
      completedAt: iso(done),
    }
  })
}

function buildReportSummary(booking: PartnerBookingRecord, type: "CHECK_IN" | "CHECK_OUT") {
  const fields = booking.reportFields.filter((field) => field.reportType === type)

  if (fields.length === 0) {
    return null
  }

  const report = booking.reports.find((item) => item.type === type) ?? null
  const valueFields = fields.filter((field) => field.fieldType !== "PHOTO" && field.fieldType !== "FILE")

  return {
    status: report ? report.status.toLowerCase() : "pending",
    submittedAt: iso(report?.submittedAt),
    photosCount: report?.assets.length ?? 0,
    fields: valueFields.map((field) => ({
      label: field.label,
      type: field.fieldType.toLowerCase(),
      value: report?.responses.find((response) => response.fieldId === field.id)?.value ?? null,
    })),
  }
}

function buildPaymentSummary(booking: PartnerBookingRecord) {
  const servicePayment = booking.payments.find((payment) => payment.kind === "SERVICE_PAYMENT") ?? null
  const deposit = booking.depositAuthorization

  return {
    currency: booking.currency,
    amount: booking.amount,
    depositAmount: booking.depositAmount,
    servicePayment: servicePayment
      ? {
          status: servicePayment.status.toLowerCase(),
          amount: servicePayment.amount,
          processedAt: iso(servicePayment.processedAt),
        }
      : null,
    deposit: deposit
      ? {
          status: deposit.status.toLowerCase(),
          amount: deposit.amount,
          authorizedAt: iso(deposit.authorizedAt),
          capturedAt: iso(deposit.capturedAt),
          releasedAt: iso(deposit.releasedAt),
          capturedAmount: deposit.depositCapturedAmount,
        }
      : null,
  }
}

function readPartnerMetadata(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { metadata: null, requestedLocale: null }
  }

  const record = value as Record<string, unknown>
  const metadata = record.metadata
  return {
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : null,
    requestedLocale: typeof record.requestedLocale === "string" ? record.requestedLocale : null,
  }
}

/**
 * The saved card of the booking (C5): status, the customer id used by
 * `POST /customers/:id/detach-card`, and the 90-day charge window. Never card
 * data (brand, last4, PaymentMethod ids stay out of partner responses).
 */
export function buildCardSecuritySummary(booking: Pick<PartnerBookingRecord, "stepSwitches" | "cardSecurity">) {
  if (!parseStepSwitches(booking.stepSwitches)?.cardSecurity) {
    return null
  }

  const card = booking.cardSecurity

  return {
    status: card?.status.toLowerCase() ?? "pending",
    customerId: card?.partnerCustomerId ?? null,
    securedAt: iso(card?.securedAt),
    windowEndsAt: iso(card?.windowEndsAt),
    detachedAt: iso(card?.detachedAt),
  }
}

/** A post-rental charge as partners see it (C6): never card data or PaymentIntent ids. */
export function presentPartnerCharge(charge: PostCharge) {
  return {
    id: charge.id,
    bookingId: charge.transactionId,
    externalRef: charge.externalRef,
    type: charge.type.toLowerCase(),
    amount: charge.amount,
    currency: charge.currency,
    description: charge.description,
    proofUrls: charge.proofUrls,
    status: charge.status.toLowerCase(),
    attempt: charge.attempt,
    declineCode: charge.declineCode,
    nextRetryAt: iso(charge.nextRetryAt),
    refundedAmount: charge.refundedAmount,
    succeededAt: iso(charge.succeededAt),
    createdAt: charge.createdAt.toISOString(),
    updatedAt: charge.updatedAt.toISOString(),
  }
}

export function buildCustomerUrl(booking: Pick<PartnerBookingRecord, "locale" | "link">, baseUrl: string) {
  return booking.link?.token ? `${baseUrl.replace(/\/$/, "")}/${booking.locale}/t/${booking.link.token}` : null
}

/** Response of `POST /api/partner/v1/bookings` (201). */
export function presentCreatedPartnerBooking(booking: PartnerBookingRecord, baseUrl: string) {
  const switches = parseStepSwitches(booking.stepSwitches)

  return {
    id: booking.id,
    reference: booking.reference,
    externalRef: booking.externalRef,
    status: booking.status.toLowerCase(),
    customerUrl: buildCustomerUrl(booking, baseUrl),
    ...(booking.link?.qrCodeSvg ? { qrCodeSvg: booking.link.qrCodeSvg } : {}),
    steps: switches ? buildBookingStepProgress(switches, booking) : [],
    startAt: iso(booking.startAt),
    endAt: iso(booking.endAt),
    createdAt: booking.createdAt.toISOString(),
  }
}

/** Response of `GET /api/partner/v1/bookings/:id` and of PATCH / cancel. */
export function presentPartnerBooking(booking: PartnerBookingRecord, baseUrl: string) {
  const switches = parseStepSwitches(booking.stepSwitches)
  const partnerMetadata = readPartnerMetadata(booking.partnerMetadata)
  const signed = booking.signatureRecord?.status === "SIGNED" && Boolean(booking.contractArtifact?.signedPdfUrl)

  return {
    id: booking.id,
    reference: booking.reference,
    externalRef: booking.externalRef,
    status: booking.status.toLowerCase(),
    customerUrl: buildCustomerUrl(booking, baseUrl),
    customer: booking.clientProfile
      ? {
          firstName: booking.clientProfile.firstName,
          lastName: booking.clientProfile.lastName,
          email: booking.clientProfile.email,
          phone: booking.clientProfile.phone,
          locale: partnerMetadata.requestedLocale ?? booking.locale,
          flowLocale: booking.locale,
        }
      : null,
    startAt: iso(booking.startAt),
    endAt: iso(booking.endAt),
    timezone: booking.timezone,
    rental: parseRentalDetails(booking.rentalDetails),
    returnUrl: booking.returnUrl,
    steps: switches ? buildBookingStepProgress(switches, booking) : [],
    contract: {
      required: Boolean(switches?.contract),
      signed,
      signedAt: signed ? iso(booking.contractArtifact?.signedAt ?? booking.signatureRecord?.signedAt) : null,
      signedPdfUrl: signed
        ? resolveDocumentAssetUrl(booking.contractArtifact?.signedPdfUrl, `${booking.reference}-signed.pdf`, baseUrl)
        : null,
    },
    checkIn: buildReportSummary(booking, "CHECK_IN"),
    checkOut: buildReportSummary(booking, "CHECK_OUT"),
    payment: buildPaymentSummary(booking),
    cardSecurity: buildCardSecuritySummary(booking),
    charges: booking.postCharges.map(presentPartnerCharge),
    link: booking.link
      ? {
          status: booking.link.status.toLowerCase(),
          openedAt: iso(booking.link.openedAt),
          completedAt: iso(booking.link.completedAt),
          cancelledAt: iso(booking.link.cancelledAt),
          cancelReason: booking.link.cancelReason,
        }
      : null,
    metadata: partnerMetadata.metadata,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  }
}
