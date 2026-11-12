import { z } from "zod"

import { requirementItemSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { STEP_SWITCH_KEYS, type StepSwitchKey } from "@/features/transactions/step-switches"
import { parseDateOnlyInput } from "@/lib/date-only"
import { DEFAULT_BOOKING_TIMEZONE, isValidIanaTimezone } from "@/lib/partner-api/bookings"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { requiredText } from "@/lib/validation/text-schemas"

/** Amounts are integers in cents (EUR). 1,000,000.00 EUR is the upper bound for a single value. */
export const MAX_AMOUNT_CENTS = 100_000_000
export const EXTERNAL_REF_MAX = 100

function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .transform((value) => (value ? value : undefined))
}

function cents(label: string) {
  return z
    .number({ error: `${label} must be a number of cents` })
    .int(`${label} must be a whole number of cents`)
    .min(0, `${label} cannot be negative`)
    .max(MAX_AMOUNT_CENTS, `${label} is too large`)
}

function positiveCents(label: string) {
  return cents(label).min(1, `${label} must be greater than zero`)
}

export const isoDateTime = (label: string) =>
  z.iso.datetime({ offset: true, error: `${label} must be an ISO 8601 date-time with offset` })

export const timezoneSchema = z
  .string()
  .trim()
  .refine(isValidIanaTimezone, "timezone must be an IANA time zone such as Europe/Paris")

const placeSchema = z.object({
  place: requiredText("Place", 120),
  address: optionalText("Address", 240),
})

export const rentalPriceLineSchema = z
  .object({
    label: requiredText("Price line label", 120),
    quantity: z.number().positive("quantity must be greater than zero").max(10_000),
    unit: optionalText("Unit", 30),
    unitAmount: cents("unitAmount"),
    total: cents("total"),
  })
  .refine((line) => Math.round(line.quantity * line.unitAmount) === line.total, {
    path: ["total"],
    message: "total must equal quantity x unitAmount",
  })

const extraDriverSchema = z.object({
  firstName: requiredText("Driver first name", INPUT_LIMITS.personName),
  lastName: requiredText("Driver last name", INPUT_LIMITS.personName),
  licenceNumber: optionalText("Driver licence number", 40),
})

export const rentalDetailsSchema = z.object({
  vehicle: z.object({
    model: requiredText("Vehicle model", 120),
    plate: optionalText("Plate", 20),
    category: optionalText("Category", 60),
    /** As the partner names it ("Diesel"): printed on the contract (LOCAZ, 12 Nov 2026). */
    fuel: optionalText("Fuel", 40),
  }),
  /**
   * The drivers named on the contract (LOCAZ, 12 Nov 2026): the main driver's licence number and each extra driver.
   * Sent with an empty `extra` list, the contract says no extra driver is authorised.
   */
  drivers: z
    .object({
      mainLicenceNumber: optionalText("Main driver licence number", 40),
      extra: z.array(extraDriverSchema).max(10).default([]),
    })
    .optional(),
  /** The renting company of a company booking, with its identifiers for the contract. */
  company: z
    .object({
      name: requiredText("Company name", 120),
      siret: optionalText("SIRET", 20),
      vatNumber: optionalText("VAT number", 20),
    })
    .optional(),
  /** The partner's published terms (https), printed on the contract as a link. */
  termsUrl: z
    .string()
    .trim()
    .max(300, "termsUrl must be 300 characters or fewer")
    .url("termsUrl must be a URL")
    .refine((value) => value.startsWith("https://"), "termsUrl must start with https://")
    .optional(),
  /** The partner's late-return rule in the booking's language ("15,00 € par heure commencée, au plus 90,00 € par jour"). */
  lateFee: optionalText("Late fee", 200),
  pickup: placeSchema,
  return: placeSchema,
  mileage: z
    .object({
      unlimited: z.boolean(),
      includedKm: z.number().int().min(0).max(1_000_000).optional(),
      extraKmPrice: cents("extraKmPrice").optional(),
    })
    .refine((mileage) => mileage.unlimited || typeof mileage.includedKm === "number", {
      path: ["includedKm"],
      message: "includedKm is required unless mileage is unlimited",
    }),
  options: z.array(requiredText("Option", 120)).max(30).default([]),
  protection: optionalText("Protection", 120),
  deductible: cents("deductible").optional(),
  deposit: cents("deposit").optional(),
  fuelPolicy: optionalText("Fuel policy", 120),
  /** The partner's own contact numbers for the contract (LOCAZ D-09, M13.13): its phone and its 24/7 assistance line. */
  lessorPhone: optionalText("Lessor phone", 40),
  assistancePhone: optionalText("Assistance phone", 40),
  priceLines: z.array(rentalPriceLineSchema).max(50).default([]),
  /** The vehicle as handed over (LOCAZ M11.1): the check-in readings printed on a contract signed at pickup. */
  departure: z
    .object({
      inspectedAt: isoDateTime("departure.inspectedAt"),
      odometerKm: z.number().int().min(0).max(2_000_000),
      fuelEighths: z.number().int().min(0).max(8),
      damages: optionalText("Damages", 1000),
      reportRef: optionalText("Report reference", 60),
    })
    .optional(),
})

export type RentalDetails = z.infer<typeof rentalDetailsSchema>
export type RentalPriceLine = z.infer<typeof rentalPriceLineSchema>

/** Reads `Transaction.rentalDetails`; returns null when absent or not a valid rental payload. */
export function parseRentalDetails(value: unknown): RentalDetails | null {
  if (!value) {
    return null
  }

  const parsed = rentalDetailsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const stepSwitchShape = Object.fromEntries(STEP_SWITCH_KEYS.map((key) => [key, z.boolean().optional()])) as Record<
  StepSwitchKey,
  z.ZodOptional<z.ZodBoolean>
>

/** Unknown step names are refused so a typo never silently disables a step. */
export const stepSwitchesInputSchema = z.strictObject(stepSwitchShape)

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/

const customerSchema = z.object({
  firstName: requiredText("First name", INPUT_LIMITS.personName),
  lastName: requiredText("Last name", INPUT_LIMITS.personName),
  email: z.string().trim().toLowerCase().max(INPUT_LIMITS.email).email("email must be a valid email address"),
  phone: z
    .string()
    .trim()
    .max(INPUT_LIMITS.phone)
    .refine((value) => PHONE_PATTERN.test(value.replace(/[\s().-]/g, "")), "phone must be in international format, e.g. +33612345678")
    .optional(),
  locale: z.enum(["fr", "en", "it"]).default("en"),
  /**
   * Embedded checkout (M10): with the postal address, birth date and birth place the customer's profile is complete,
   * so the partner's site needs no profile screen. Optional; without them Contrazy's pages ask.
   */
  address: z
    .object({
      line1: requiredText("address.line1", INPUT_LIMITS.address),
      postalCode: z.string().trim().min(2, "address.postalCode is required").max(12),
      city: requiredText("address.city", INPUT_LIMITS.city),
      country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "address.country must be an ISO 3166-1 alpha-2 code, e.g. FR"),
    })
    .optional(),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birthDate must be a date, e.g. 1988-05-20")
    .refine((value) => {
      const parsed = parseDateOnlyInput(value)
      return Boolean(parsed) && parsed! <= new Date()
    }, "birthDate must be a past date")
    .optional(),
  birthPlace: requiredText("birthPlace", INPUT_LIMITS.city).optional(),
})

const metadataSchema = z
  .record(
    z.string().min(1).max(40),
    z.union([z.string().max(500), z.number(), z.boolean(), z.null()])
  )
  .refine((value) => Object.keys(value).length <= 50, "metadata can hold at most 50 keys")

const returnUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url("returnUrl must be an absolute URL")
  .refine((value) => /^https?:\/\//i.test(value), "returnUrl must use http or https")

export function validateBookingWindow(startAt: Date, endAt: Date) {
  return endAt.getTime() > startAt.getTime()
}

export const partnerBookingCreateSchema = z
  .object({
    externalRef: requiredText("externalRef", EXTERNAL_REF_MAX),
    customer: customerSchema,
    startAt: isoDateTime("startAt"),
    endAt: isoDateTime("endAt"),
    timezone: timezoneSchema.default(DEFAULT_BOOKING_TIMEZONE),
    rental: rentalDetailsSchema,
    amount: positiveCents("amount").nullable().optional(),
    depositAmount: positiveCents("depositAmount").nullable().optional(),
    currency: z.literal("EUR", { error: "Only EUR is supported" }).default("EUR"),
    steps: stepSwitchesInputSchema,
    returnUrl: returnUrlSchema.optional(),
    contractTemplateId: z.string().trim().min(1).max(64).optional(),
    /** The contract is signed at pickup, after the check-in (LOCAZ M11.1): skipped at booking, opened with `contract/open`. */
    contractAtPickup: z.boolean().optional(),
    requirements: z.array(requirementItemSchema).max(20).optional(),
    qrCode: z.boolean().optional(),
    metadata: metadataSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!validateBookingWindow(new Date(data.startAt), new Date(data.endAt))) {
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "endAt must be after startAt" })
    }

    if (data.steps.payment && !data.amount) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "amount is required when steps.payment is on" })
    }

    if (data.steps.hold && !data.depositAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["depositAmount"],
        message: "depositAmount is required when steps.hold is on",
      })
    }

    if (data.steps.selfie && !data.steps.identity) {
      ctx.addIssue({ code: "custom", path: ["steps", "selfie"], message: "steps.selfie requires steps.identity" })
    }

    if (data.contractAtPickup && data.steps.contract === false) {
      ctx.addIssue({ code: "custom", path: ["contractAtPickup"], message: "contractAtPickup needs steps.contract" })
    }
  })

export type PartnerBookingCreateInput = z.infer<typeof partnerBookingCreateSchema>

export const partnerBookingUpdateSchema = z
  .strictObject({
    startAt: isoDateTime("startAt").optional(),
    endAt: isoDateTime("endAt").optional(),
    timezone: timezoneSchema.optional(),
    rental: rentalDetailsSchema.optional(),
    steps: stepSwitchesInputSchema.optional(),
    amount: positiveCents("amount").nullable().optional(),
    depositAmount: positiveCents("depositAmount").nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), "Provide at least one field to update")

export type PartnerBookingUpdateInput = z.infer<typeof partnerBookingUpdateSchema>

/** `POST /bookings/:id/contract/open`: the rental as handed over, with the check-in readings (`rental.departure`). */
export const partnerContractOpenSchema = z.strictObject({
  rental: rentalDetailsSchema.refine((rental) => Boolean(rental.departure), { path: ["departure"], message: "departure is required to open the contract" }),
})

export type PartnerContractOpenInput = z.infer<typeof partnerContractOpenSchema>

export const partnerBookingCancelSchema = z.object({
  reason: requiredText("reason", INPUT_LIMITS.cancelReason),
})
