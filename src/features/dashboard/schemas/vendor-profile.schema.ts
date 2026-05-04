import { z } from "zod"

import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { emailText, optionalEmailText, phoneText, requiredText } from "@/lib/validation/text-schemas"

export const vendorProfileSchema = z.object({
  fullName: requiredText("Full name", INPUT_LIMITS.personName, {
    min: 2,
    requiredMessage: "Full name is required",
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
})

export const vendorReviewSchema = z.object({
  reviewStatus: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]),
})

export type VendorProfileInput = z.infer<typeof vendorProfileSchema>
