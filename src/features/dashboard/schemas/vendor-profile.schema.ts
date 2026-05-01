import { z } from "zod"

export const vendorProfileSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(100),
  businessName: z.string().min(2, "Business name is required").max(120),
  businessEmail: z.string().email("Business email must be valid"),
  supportEmail: z.string().email("Support email must be valid").or(z.literal("")),
  businessPhone: z.string().min(6, "Phone number is required").max(40),
  businessAddress: z.string().min(5, "Address is required").max(160),
  businessCountry: z.string().min(2, "Country is required").max(80),
})

export const vendorReviewSchema = z.object({
  reviewStatus: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING"]),
})

export type VendorProfileInput = z.infer<typeof vendorProfileSchema>
