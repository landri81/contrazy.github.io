import { PaymentCollectionTiming, TransactionFlowType } from "@prisma/client"

import { ConsentPartiesMissingError, consentPartiesFor } from "@/features/card-security/consent-texts"
import { requirementItemSchema, type VendorTransactionCreateInput } from "@/features/dashboard/schemas/vendor-operations.schema"
import type { PartnerBookingCreateInput, RentalDetails } from "@/features/partner-api/schemas/booking.schema"
import type { StepSwitchKey, StepSwitches } from "@/features/transactions/step-switches"
import { resolveFlowLocale, serviceDateFromStartAt } from "@/lib/partner-api/bookings"
import { PartnerApiError } from "@/lib/partner-api/errors"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

type FlowLocale = "en" | "fr"

/** Same value as `FREE_DEPOSIT_HOLD_DAYS` (server-only module): partner bookings use the standard hold. */
const BOOKING_DEPOSIT_HOLD_DAYS = 7
type RequirementInput = VendorTransactionCreateInput["requirements"][number]
type ReportFieldInput = VendorTransactionCreateInput["reportFields"][number]
type ReportType = ReportFieldInput["reportType"]

const defaultCopy = {
  en: {
    licence: "Driving licence",
    licenceHelp: "Upload both sides of a valid driving licence.",
    front: "Front",
    back: "Back",
    mileage: "Mileage (km)",
    fuel: "Fuel level",
    fuelOptions: ["Full", "3/4", "1/2", "1/4", "Reserve"],
    photos: "Vehicle photos",
    photosHelp: "Front, back, both sides and any existing damage.",
    notes: "Remarks",
  },
  fr: {
    licence: "Permis de conduire",
    licenceHelp: "Téléversez le recto et le verso d'un permis de conduire valide.",
    front: "Recto",
    back: "Verso",
    mileage: "Kilométrage (km)",
    fuel: "Niveau de carburant",
    fuelOptions: ["Plein", "3/4", "1/2", "1/4", "Réserve"],
    photos: "Photos du véhicule",
    photosHelp: "Avant, arrière, les deux côtés et les dommages existants.",
    notes: "Remarques",
  },
} as const

/** Default document request for a rental when the partner sends no `requirements`. */
export function buildDefaultRentalRequirements(locale: FlowLocale): RequirementInput[] {
  const copy = defaultCopy[locale]

  return [
    requirementItemSchema.parse({
      label: copy.licence,
      description: copy.licenceHelp,
      type: "DOCUMENT",
      category: "DRIVER_LICENSE",
      required: true,
      requiredFileCount: 2,
      fileSlotLabels: [copy.front, copy.back],
    }),
  ]
}

/** Default check-in / check-out report: mileage, fuel, photos, remarks. */
export function buildDefaultRentalReportFields(locale: FlowLocale, reportType: ReportType): ReportFieldInput[] {
  const copy = defaultCopy[locale]

  return [
    { label: copy.mileage, instructions: null, fieldType: "NUMBER", reportType, selectOptions: [] },
    { label: copy.fuel, instructions: null, fieldType: "SELECT", reportType, selectOptions: [...copy.fuelOptions] },
    { label: copy.photos, instructions: copy.photosHelp, fieldType: "PHOTO", reportType, selectOptions: [] },
    { label: copy.notes, instructions: null, fieldType: "TEXT", reportType, selectOptions: [] },
  ]
}

export function buildReportFieldsForSwitches(switches: Pick<StepSwitches, "checkIn" | "checkOut">, locale: FlowLocale) {
  return [
    ...(switches.checkIn ? buildDefaultRentalReportFields(locale, "CHECK_IN") : []),
    ...(switches.checkOut ? buildDefaultRentalReportFields(locale, "CHECK_OUT") : []),
  ]
}

export function resolveBookingStepSwitches(steps: PartnerBookingCreateInput["steps"]): StepSwitches {
  return {
    identity: steps.identity === true,
    selfie: steps.selfie === true,
    documents: steps.documents === true,
    contract: steps.contract === true,
    checkIn: steps.checkIn === true,
    checkOut: steps.checkOut === true,
    payment: steps.payment === true,
    cardSecurity: steps.cardSecurity === true,
    hold: steps.hold === true,
  }
}

/**
 * Switches that need something on the vendor account before they can be on.
 * Card security (C5): the consent text names the vendor and a dispute contact
 * (Spec v2.1 §6), so both must exist. Refused rather than silently ignored.
 */
export function findUnsupportedStepSwitches(
  switches: StepSwitches,
  vendor: { businessName: string | null; supportEmail: string | null; businessEmail: string | null }
): StepSwitchKey[] {
  const unsupported: StepSwitchKey[] = []

  if (switches.cardSecurity) {
    try {
      consentPartiesFor(vendor)
    } catch (error) {
      if (!(error instanceof ConsentPartiesMissingError)) throw error
      unsupported.push("cardSecurity")
    }
  }

  return unsupported
}

/** Throws 422 `step_requires_configuration` when a switch is on that the vendor account cannot honour yet. */
export function assertSupportedStepSwitches(
  switches: StepSwitches,
  vendor: { businessName: string | null; supportEmail: string | null; businessEmail: string | null }
) {
  const unsupported = findUnsupportedStepSwitches(switches, vendor)

  if (unsupported.length > 0) {
    throw new PartnerApiError(
      "step_requires_configuration",
      `${unsupported.map((key) => `steps.${key}`).join(", ")} needs a business name and a support e-mail on the vendor profile (the card consent names them). Complete the profile, or send false.`,
      { details: { steps: unsupported.map((key) => `steps.${key}`) } }
    )
  }
}

export function buildBookingTitle(rental: Pick<RentalDetails, "vehicle">, externalRef: string) {
  const title = `${rental.vehicle.model} · ${externalRef}`
  return title.length > INPUT_LIMITS.transactionTitle ? `${title.slice(0, INPUT_LIMITS.transactionTitle - 1)}…` : title
}

/**
 * Maps a partner booking onto the dashboard launch input so the booking goes
 * through `prepareVendorTransactionLaunch` like any dashboard transaction:
 * a switched-off step simply contributes no configuration.
 */
export function buildBookingLaunchInput(
  booking: PartnerBookingCreateInput,
  options: { contractTemplateId: string | null }
): VendorTransactionCreateInput {
  // Callers check the switches against the vendor first (assertSupportedStepSwitches).
  const switches = resolveBookingStepSwitches(booking.steps)
  const locale = resolveFlowLocale(booking.customer.locale)
  const reportFields = buildReportFieldsForSwitches(switches, locale)

  return {
    title: buildBookingTitle(booking.rental, booking.externalRef),
    serviceDate: serviceDateFromStartAt(new Date(booking.startAt), booking.timezone),
    recreateFromTransactionId: null,
    notes: null,
    contractTemplateId: switches.contract ? options.contractTemplateId : null,
    checklistTemplateId: null,
    amount: switches.payment ? (booking.amount ?? null) : null,
    depositAmount: switches.hold ? (booking.depositAmount ?? null) : null,
    depositHoldDays: BOOKING_DEPOSIT_HOLD_DAYS,
    depositLongTermFeeAccepted: false,
    requiresKyc: switches.identity,
    // Validated upstream (steps.selfie requires steps.identity); the launch refuses it otherwise.
    requireSelfie: switches.selfie,
    generateQr: booking.qrCode === true,
    paymentCollectionTiming: PaymentCollectionTiming.AFTER_SIGNING,
    requireClientCompany: false,
    requirements: switches.documents
      ? booking.requirements && booking.requirements.length > 0
        ? booking.requirements
        : buildDefaultRentalRequirements(locale)
      : [],
    customFields: [],
    flowType: reportFields.length > 0 ? TransactionFlowType.CHECK_IN_OUT : TransactionFlowType.STANDARD,
    reportFields,
  }
}
