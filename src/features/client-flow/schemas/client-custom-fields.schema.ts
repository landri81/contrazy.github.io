import { z } from "zod"

import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import { requiredText } from "@/lib/validation/text-schemas"

export const clientCustomFieldResponsesSchema = z.object({
  responses: z.array(
    z.object({
      customFieldId: requiredText("Customer field identifier", 100, {
        requiredMessage: "Customer field identifier is required",
      }),
      value: requiredText("Customer field value", INPUT_LIMITS.transactionCustomFieldValue, {
        requiredMessage: "Customer field value is required",
      }),
    })
  ),
})
