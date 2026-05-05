import { z } from "zod"

import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { emailText, optionalText, phoneText, requiredText } from "@/lib/validation/text-schemas"

export const clientProfileSchema = z
  .object({
    firstName: requiredText("First name", INPUT_LIMITS.personName, {
      min: 2,
      requiredMessage: "First name is required",
    }),
    lastName: requiredText("Last name", INPUT_LIMITS.personName, {
      min: 2,
      requiredMessage: "Last name is required",
    }),
    email: emailText("Email address"),
    phone: phoneText("Phone number", false).optional(),
    companyName: optionalText("Company name", INPUT_LIMITS.clientCompanyName).optional(),
    address: requiredText("Address", INPUT_LIMITS.address, {
      min: 5,
      requiredMessage: "Address is required",
    }),
    country: requiredText("Country", INPUT_LIMITS.country, {
      min: 2,
      requiredMessage: "Country is required",
    }),
  })
  .transform((data) => ({
    ...data,
    fullName: `${data.firstName} ${data.lastName}`.trim(),
    phone: typeof data.phone === "string" && data.phone.length > 0 ? data.phone : null,
    companyName: typeof data.companyName === "string" && data.companyName.length > 0 ? data.companyName : null,
  }))
