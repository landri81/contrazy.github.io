import {
  type LocaleCode,
  type PartnerApiKey,
  Prisma,
  TransactionLinkActor,
  type VendorProfile,
} from "@prisma/client"
import { z } from "zod"

import { LOCAZ_RENTAL_CONTRACT_TEMPLATE_NAME } from "@/features/contracts/server/locaz-rental-template"
import { requirementItemSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import {
  assertSupportedStepSwitches,
  buildBookingLaunchInput,
  buildBookingTitle,
  resolveBookingStepSwitches,
} from "@/features/partner-api/booking-launch"
import {
  partnerBookingInclude,
  presentCreatedPartnerBooking,
  presentPartnerBooking,
  type PartnerBookingRecord,
} from "@/features/partner-api/booking-presenter"
import { clientProfileFromPartnerCustomer } from "@/features/partner-api/customer-profile"
import {
  parseRentalDetails,
  validateBookingWindow,
  type PartnerBookingCreateInput,
  type PartnerBookingUpdateInput,
  type RentalDetails,
} from "@/features/partner-api/schemas/booking.schema"
import { incrementVendorSubscriptionUsageFields } from "@/features/subscriptions/server/subscription-usage"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { cancelTransactionLink } from "@/features/transactions/server/transaction-links"
import {
  createPreparedVendorTransaction,
  prepareVendorTransactionLaunch,
  writePreparedTransactionConfiguration,
  type PreparedVendorTransactionLaunch,
  type VendorTransactionLaunchFailureCode,
} from "@/features/transactions/server/vendor-transaction-launch"
import {
  DEFAULT_STEP_SWITCHES,
  getChangedStepSwitchKeys,
  mergeStepSwitches,
  parseStepSwitches,
  type StepSwitches,
} from "@/features/transactions/step-switches"
import { ensureVendorSubscriptionEligible, getVendorStatusMessage, isVendorApproved } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import {
  isBookingLocked,
  isReturnUrlAllowed,
  normalizeOrigin,
  resolveFlowLocale,
  serviceDateFromStartAt,
  type PartnerCustomerLocale,
} from "@/lib/partner-api/bookings"
import { PartnerApiError, type PartnerApiErrorCode } from "@/lib/partner-api/errors"
import { isUniqueConstraintError } from "@/lib/partner-api/idempotency-store"

export const PARTNER_BOOKING_LOCKED_ACTION = "partner_api.booking_locked"

type PartnerCaller = {
  request: Request
  vendorProfile: VendorProfile
  apiKey: Pick<PartnerApiKey, "id" | "prefix">
  requestId: string
}

/** Stored in `Transaction.partnerMetadata`: what the partner sent that has no column of its own. */
type StoredPartnerMetadata = {
  metadata: Record<string, unknown> | null
  requestedLocale: PartnerCustomerLocale
  requirements: PartnerBookingCreateInput["requirements"] | null
  contractTemplateId: string | null
  apiKeyId: string
  apiKeyPrefix: string
  requestId: string
}

const storedRequirementsSchema = z.array(requirementItemSchema)

function readStoredPartnerMetadata(value: Prisma.JsonValue | null) {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const requirements = storedRequirementsSchema.safeParse(record.requirements)
  const locale = record.requestedLocale

  return {
    requestedLocale: (locale === "fr" || locale === "it" || locale === "en" ? locale : null) as PartnerCustomerLocale | null,
    requirements: requirements.success ? requirements.data : undefined,
    contractTemplateId: typeof record.contractTemplateId === "string" ? record.contractTemplateId : undefined,
  }
}

const LAUNCH_FAILURE_CODES: Record<VendorTransactionLaunchFailureCode, PartnerApiErrorCode> = {
  transaction_limit_reached: "plan_limit_reached",
  qr_limit_reached: "plan_limit_reached",
  kyc_quota_reached: "plan_limit_reached",
  selfie_requires_identity: "invalid_request",
  kyc_not_in_plan: "plan_feature_unavailable",
  long_deposit_not_in_plan: "plan_feature_unavailable",
  stripe_not_connected: "stripe_not_connected",
  contract_template_not_found: "contract_template_not_found",
  checklist_not_found: "launch_rejected",
  no_workflow_module: "launch_rejected",
}

/** Turns a refused dashboard launch into a partner error with a stable code (402/403/422). */
export async function mapLaunchFailure(failure: { response: Response; code?: VendorTransactionLaunchFailureCode }) {
  const payload = (await failure.response
    .clone()
    .json()
    .catch(() => null)) as { message?: unknown } | null
  const message = typeof payload?.message === "string" ? payload.message : "The booking could not be launched."
  const code = failure.code ? LAUNCH_FAILURE_CODES[failure.code] : "launch_rejected"

  return new PartnerApiError(code, message, {
    details: { reason: failure.code ?? "launch_rejected" },
  })
}

/** Vendor approval (403) and an active subscription (402) are required to launch or reconfigure. */
async function requireLaunchableVendor(vendorProfile: VendorProfile) {
  if (!isVendorApproved(vendorProfile)) {
    throw new PartnerApiError("vendor_not_approved", getVendorStatusMessage(vendorProfile.reviewStatus))
  }

  const { response, subscription } = await ensureVendorSubscriptionEligible(vendorProfile.id)

  if (response || !subscription) {
    throw new PartnerApiError(
      "subscription_required",
      "An active Contrazy subscription is required to create or change bookings."
    )
  }

  return subscription
}

export function assertReturnUrlAllowed(returnUrl: string | null | undefined, allowedOrigins: readonly string[]) {
  if (!returnUrl) {
    return
  }

  if (!isReturnUrlAllowed(returnUrl, allowedOrigins)) {
    throw new PartnerApiError(
      "return_url_not_allowed",
      "returnUrl must start with one of the origins allowed for this vendor.",
      { details: { returnUrlOrigin: normalizeOrigin(returnUrl) } }
    )
  }
}

/** Template for `steps.contract`: the one sent, else the vendor default, else the seeded LOCAZ template. */
async function resolveContractTemplateId(vendorId: string, requested: string | null | undefined) {
  if (requested) {
    return requested
  }

  const template =
    (await prisma.contractTemplate.findFirst({
      where: { vendorId, isDefault: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    })) ??
    (await prisma.contractTemplate.findFirst({
      where: { vendorId, name: LOCAZ_RENTAL_CONTRACT_TEMPLATE_NAME },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }))

  if (!template) {
    throw new PartnerApiError(
      "contract_template_required",
      "steps.contract is on, but no contractTemplateId was sent and this vendor has no default contract template."
    )
  }

  return template.id
}

async function findPartnerBooking(vendorId: string, where: { id: string } | { externalRef: string }) {
  return prisma.transaction.findFirst({
    where: { vendorId, source: "PARTNER_API", ...where },
    include: partnerBookingInclude,
  })
}

/** Bookings are scoped to the key's vendor: another vendor's booking is a plain 404. */
export async function requirePartnerBooking(vendorId: string, where: { id: string } | { externalRef: string }) {
  const booking = await findPartnerBooking(vendorId, where)

  if (!booking) {
    throw new PartnerApiError("not_found", "No booking matches this reference for this vendor.")
  }

  return booking
}

export async function getPartnerBooking(vendorId: string, where: { id: string } | { externalRef: string }) {
  return presentPartnerBooking(await requirePartnerBooking(vendorId, where), getAppBaseUrl())
}

function withFlowLocale(prepared: PreparedVendorTransactionLaunch, locale: PartnerCustomerLocale) {
  return { ...prepared, locale: resolveFlowLocale(locale) as LocaleCode }
}

export async function createPartnerBooking(
  caller: PartnerCaller,
  input: PartnerBookingCreateInput
): Promise<ReturnType<typeof presentCreatedPartnerBooking>> {
  const { vendorProfile } = caller
  const switches = resolveBookingStepSwitches(input.steps)

  assertSupportedStepSwitches(switches, vendorProfile)
  assertReturnUrlAllowed(input.returnUrl, vendorProfile.partnerAllowedOrigins)

  const subscription = await requireLaunchableVendor(vendorProfile)

  const duplicate = await prisma.transaction.findFirst({
    where: { vendorId: vendorProfile.id, externalRef: input.externalRef },
    select: { id: true },
  })

  if (duplicate) {
    throw new PartnerApiError("external_ref_conflict", "A booking with this externalRef already exists.", {
      details: { bookingId: duplicate.id },
    })
  }

  const contractTemplateId = switches.contract
    ? await resolveContractTemplateId(vendorProfile.id, input.contractTemplateId)
    : null
  const launch = await prepareVendorTransactionLaunch({
    request: caller.request,
    vendorProfile,
    subscription,
    data: buildBookingLaunchInput(input, { contractTemplateId }),
    allowRecreate: false,
    cardSecurity: switches.cardSecurity,
  })

  if (!launch.ok) {
    throw await mapLaunchFailure(launch)
  }

  const prepared = withFlowLocale(launch.prepared, input.customer.locale)
  const partnerMetadata: StoredPartnerMetadata = {
    metadata: input.metadata ?? null,
    requestedLocale: input.customer.locale,
    requirements: input.requirements ?? null,
    contractTemplateId: input.contractTemplateId ?? null,
    apiKeyId: caller.apiKey.id,
    apiKeyPrefix: caller.apiKey.prefix,
    requestId: caller.requestId,
  }

  let createdId: string

  try {
    createdId = await prisma.$transaction(
      async (tx) => {
        const { customer } = input
        const clientProfile = await tx.clientProfile.create({
          data: {
            vendorId: vendorProfile.id,
            ...clientProfileFromPartnerCustomer(customer),
          },
        })
        const transaction = await createPreparedVendorTransaction(tx, prepared, {
          vendorId: vendorProfile.id,
          cloneRecreateSource: false,
          extraTransactionData: {
            clientProfileId: clientProfile.id,
            source: "PARTNER_API",
            externalRef: input.externalRef,
            startAt: new Date(input.startAt),
            endAt: new Date(input.endAt),
            timezone: input.timezone,
            rentalDetails: input.rental as Prisma.InputJsonValue,
            returnUrl: input.returnUrl ?? null,
            stepSwitches: switches as Prisma.InputJsonValue,
            partnerMetadata: partnerMetadata as unknown as Prisma.InputJsonValue,
          },
        })

        await incrementVendorSubscriptionUsageFields(tx, vendorProfile.id, {
          transactionsUsed: 1,
          qrCodesUsed: prepared.generateQr === true ? 1 : 0,
        })

        return transaction.id
      },
      { maxWait: 10_000, timeout: 15_000 }
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new PartnerApiError("external_ref_conflict", "A booking with this externalRef already exists.")
    }

    throw error
  }

  return presentCreatedPartnerBooking(await requirePartnerBooking(vendorProfile.id, { id: createdId }), prepared.baseUrl)
}

function invalid(path: string, message: string) {
  return new PartnerApiError("invalid_request", `${path}: ${message}`, { details: { issues: [{ path, message }] } })
}

async function auditLockedBookingChange(caller: PartnerCaller, booking: PartnerBookingRecord, input: PartnerBookingUpdateInput) {
  const currentSwitches = parseStepSwitches(booking.stepSwitches) ?? DEFAULT_STEP_SWITCHES
  const requestedSteps = input.steps ? getChangedStepSwitchKeys(currentSwitches, mergeStepSwitches(currentSwitches, input.steps)) : []

  try {
    await prisma.auditLog.create({
      data: {
        actorType: "SYSTEM",
        action: PARTNER_BOOKING_LOCKED_ACTION,
        entityType: "Transaction",
        entityId: booking.id,
        metadata: {
          vendorId: booking.vendorId,
          externalRef: booking.externalRef,
          keyPrefix: caller.apiKey.prefix,
          apiKeyId: caller.apiKey.id,
          requestId: caller.requestId,
          fields: Object.keys(input).filter((key) => input[key as keyof PartnerBookingUpdateInput] !== undefined),
          requestedStepChanges: requestedSteps,
          status: booking.status,
          linkOpenedAt: booking.link?.openedAt?.toISOString() ?? null,
        },
      },
    })
  } catch (error) {
    console.error("Partner booking lock audit skipped", {
      bookingId: booking.id,
      requestId: caller.requestId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

/**
 * Changes dates, rental details, amounts or step switches of a booking the
 * customer has not started. Step or amount changes go through
 * `prepareVendorTransactionLaunch` again and rewrite the booking configuration.
 */
export async function updatePartnerBooking(caller: PartnerCaller, bookingId: string, input: PartnerBookingUpdateInput) {
  const { vendorProfile } = caller
  const booking = await requirePartnerBooking(vendorProfile.id, { id: bookingId })

  if (isBookingLocked({ status: booking.status, link: booking.link })) {
    await auditLockedBookingChange(caller, booking, input)
    throw new PartnerApiError(
      "booking_locked",
      "The customer has already started this booking, so it can no longer be changed.",
      { details: { status: booking.status.toLowerCase() } }
    )
  }

  const timezone = input.timezone ?? booking.timezone
  const startAt = input.startAt ? new Date(input.startAt) : booking.startAt
  const endAt = input.endAt ? new Date(input.endAt) : booking.endAt

  if (!startAt || !endAt || !validateBookingWindow(startAt, endAt)) {
    throw invalid("endAt", "endAt must be after startAt")
  }

  const currentSwitches: StepSwitches = parseStepSwitches(booking.stepSwitches) ?? DEFAULT_STEP_SWITCHES
  const nextSwitches = mergeStepSwitches(currentSwitches, input.steps)
  const changedSteps = getChangedStepSwitchKeys(currentSwitches, nextSwitches)

  assertSupportedStepSwitches(nextSwitches, caller.vendorProfile)

  if (nextSwitches.selfie && !nextSwitches.identity) {
    throw invalid("steps.selfie", "steps.selfie requires steps.identity")
  }

  const amount = input.amount !== undefined ? input.amount : booking.amount
  const depositAmount = input.depositAmount !== undefined ? input.depositAmount : booking.depositAmount

  if (nextSwitches.payment && !amount) {
    throw invalid("amount", "amount is required when steps.payment is on")
  }

  if (nextSwitches.hold && !depositAmount) {
    throw invalid("depositAmount", "depositAmount is required when steps.hold is on")
  }

  const rental: RentalDetails | null = input.rental ?? parseRentalDetails(booking.rentalDetails)
  const needsReconfiguration =
    changedSteps.length > 0 || input.amount !== undefined || input.depositAmount !== undefined
  let prepared: PreparedVendorTransactionLaunch | null = null

  if (needsReconfiguration) {
    if (!rental) {
      throw invalid("rental", "rental is required to change steps or amounts of this booking")
    }

    const stored = readStoredPartnerMetadata(booking.partnerMetadata)
    const subscription = await requireLaunchableVendor(vendorProfile)
    const contractTemplateId = nextSwitches.contract
      ? booking.contractTemplateId ?? (await resolveContractTemplateId(vendorProfile.id, stored.contractTemplateId))
      : null
    const launch = await prepareVendorTransactionLaunch({
      request: caller.request,
      vendorProfile,
      subscription,
      allowRecreate: false,
      reconfigureExisting: true,
      cardSecurity: nextSwitches.cardSecurity,
      data: buildBookingLaunchInput(
        {
          externalRef: booking.externalRef ?? booking.reference,
          customer: {
            firstName: booking.clientProfile?.firstName ?? "",
            lastName: booking.clientProfile?.lastName ?? "",
            email: booking.clientProfile?.email ?? "",
            locale: stored.requestedLocale ?? booking.locale,
          },
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          timezone,
          rental,
          amount,
          depositAmount,
          currency: "EUR",
          steps: nextSwitches,
          requirements: stored.requirements,
          qrCode: false,
        },
        { contractTemplateId }
      ),
    })

    if (!launch.ok) {
      throw await mapLaunchFailure(launch)
    }

    prepared = launch.prepared
  }

  const changedFields = Object.keys(input).filter((key) => input[key as keyof PartnerBookingUpdateInput] !== undefined)

  await prisma.$transaction(
    async (tx) => {
      if (prepared) {
        await tx.transactionRequirement.deleteMany({ where: { transactionId: booking.id } })
        await tx.transactionCustomField.deleteMany({ where: { transactionId: booking.id } })
        await tx.transactionReportField.deleteMany({ where: { transactionId: booking.id } })
        await tx.transactionContractArtifact.deleteMany({ where: { transactionId: booking.id } })
      }

      await tx.transaction.update({
        where: { id: booking.id },
        data: {
          startAt,
          endAt,
          timezone,
          serviceDate: serviceDateFromStartAt(startAt, timezone),
          stepSwitches: nextSwitches as Prisma.InputJsonValue,
          ...(input.rental
            ? {
                rentalDetails: input.rental as Prisma.InputJsonValue,
                title: buildBookingTitle(input.rental, booking.externalRef ?? booking.reference),
              }
            : {}),
          ...(prepared
            ? {
                amount: prepared.amount,
                depositAmount: prepared.depositAmount,
                depositHoldDays: prepared.depositHoldDays,
                requiresKyc: prepared.requiresKyc,
                requireSelfie: prepared.requireSelfie,
                kind: prepared.kind,
                flowType: prepared.flowType,
                paymentCollectionTiming: prepared.paymentCollectionTiming,
                contractTemplateId: prepared.contractTemplate?.id ?? null,
              }
            : {}),
        },
      })

      if (prepared) {
        await writePreparedTransactionConfiguration(tx, booking.id, prepared)
      }

      await recordTransactionEvent(tx, {
        transactionId: booking.id,
        type: "LINK_UPDATED",
        title: "Booking updated by partner",
        detail: `Updated before the customer started: ${changedFields.join(", ")}.`,
        metadata: { source: "partner_api", fields: changedFields, changedSteps, requestId: caller.requestId },
      })
    },
    { maxWait: 10_000, timeout: 15_000 }
  )

  return getPartnerBooking(vendorProfile.id, { id: booking.id })
}

/** Cancels the booking through the dashboard's `cancelTransactionLink`. Cancelling twice is a no-op. */
export async function cancelPartnerBooking(caller: PartnerCaller, bookingId: string, reason: string) {
  const { vendorProfile } = caller
  const booking = await requirePartnerBooking(vendorProfile.id, { id: bookingId })

  if (!booking.link) {
    throw new PartnerApiError("booking_not_cancellable", "This booking has no customer link to cancel.")
  }

  const result = await cancelTransactionLink(prisma, {
    linkId: booking.link.id,
    actor: TransactionLinkActor.VENDOR,
    reason,
    detail: `The partner cancelled this booking before the workflow was completed. Reason: ${reason}`,
    title: "Partner cancelled the booking",
  })

  if (!result.ok && result.code === "COMPLETED") {
    throw new PartnerApiError("booking_not_cancellable", "This booking is completed and can no longer be cancelled.")
  }

  if (!result.ok && result.code === "NOT_FOUND") {
    throw new PartnerApiError("not_found", "No booking matches this reference for this vendor.")
  }

  return getPartnerBooking(vendorProfile.id, { id: booking.id })
}
