import { z } from "zod"

// E.164-ish: starts with +, followed by 7–15 digits (with optional spaces/dashes)
const phoneRegex = /^\+[1-9]\d{0,2}[\s\-]?\d{4,14}$/

export const vendorProfileSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(100),
  businessName: z.string().min(2, "Business name is required").max(120),
  businessEmail: z.string().email("Business email must be valid"),
  supportEmail: z.string().email("Support email must be valid").or(z.literal("")),
  businessPhone: z
    .string()
    .min(1, "Phone number is required")
    .regex(phoneRegex, "Enter a valid phone number with country code (e.g. +1 202 555 0100)"),
  businessAddress: z.string().min(5, "Address is required").max(160),
  businessCountry: z.string().min(2, "Country is required").max(80),
})

export const vendorReviewSchema = z.object({
  reviewStatus: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]),
})

export type VendorProfileInput = z.infer<typeof vendorProfileSchema>
