import { z } from "zod"

import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { emailText, optionalText, phoneText, requiredText } from "@/lib/validation/text-schemas"

export const clientProfileSchema = z
  .object({
    fullName: requiredText("Full name", INPUT_LIMITS.personName, {
      min: 2,
      requiredMessage: "Name is required",
    }),
    email: emailText("Email address"),
    phone: phoneText("Phone number", false).optional(),
    companyName: optionalText("Company name", INPUT_LIMITS.clientCompanyName).optional(),
  })
  .transform((data) => ({
    ...data,
    phone: typeof data.phone === "string" && data.phone.length > 0 ? data.phone : null,
    companyName: typeof data.companyName === "string" && data.companyName.length > 0 ? data.companyName : null,
  }))
