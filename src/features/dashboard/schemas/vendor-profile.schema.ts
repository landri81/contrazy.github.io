import { z } from "zod"

import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { emailText, optionalEmailText, optionalText, phoneText, requiredText } from "@/lib/validation/text-schemas"

export function isFrenchBusinessCountry(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  return normalized === "fr" || normalized === "france"
}

function normalizeFrenchRegistrationNumber(value: string) {
  return value.replace(/\D/g, "")
}

export const vendorProfileSchema = z
  .object({
    ownerFirstName: requiredText("First name", INPUT_LIMITS.personName, {
      min: 2,
      requiredMessage: "First name is required",
    }),
    ownerLastName: requiredText("Last name", INPUT_LIMITS.personName, {
      min: 2,
      requiredMessage: "Last name is required",
    }),
    businessName: requiredText("Business name", INPUT_LIMITS.businessName, {
      min: 2,
      requiredMessage: "Business name is required",
    }),
    businessEmail: emailText("Business email"),
    supportEmail: optionalEmailText("Support email"),
    businessPhone: phoneText(),
    businessAddress: requiredText("Address", INPUT_LIMITS.address, {
      min: 5,
      requiredMessage: "Address is required",
    }),
    businessCountry: requiredText("Country", INPUT_LIMITS.country, {
      min: 2,
      requiredMessage: "Country is required",
    }),
    registrationNumber: requiredText("Registration number", INPUT_LIMITS.registrationNumber, {
      min: 2,
      requiredMessage: "Registration number is required",
    }),
    vatNumber: optionalText("VAT number", INPUT_LIMITS.vatNumber).optional(),
    businessLogoUrl: optionalText("Business logo URL", 500).optional(),
    businessLogoPublicId: optionalText("Business logo public ID", 255).optional(),
    businessLogoFileName: optionalText("Business logo file name", 255).optional(),
    preferredLocale: z.enum(["en", "fr"]).default("en"),
  })
  .superRefine((data, ctx) => {
    if (!isFrenchBusinessCountry(data.businessCountry)) {
      return
    }

    const normalizedRegistrationNumber = normalizeFrenchRegistrationNumber(data.registrationNumber)

    if (normalizedRegistrationNumber.length !== 9 || normalizedRegistrationNumber !== data.registrationNumber.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationNumber"],
        message: "For France, the registration number must contain exactly 9 digits.",
      })
    }
  })

export const vendorReviewSchema = z.object({
  reviewStatus: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]),
})

export type VendorProfileInput = z.infer<typeof vendorProfileSchema>
