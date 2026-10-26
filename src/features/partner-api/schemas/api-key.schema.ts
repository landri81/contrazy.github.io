import { z } from "zod"

import { PARTNER_API_SCOPES } from "@/lib/partner-api/scopes"
import { requiredText } from "@/lib/validation/text-schemas"

export const PARTNER_API_KEY_NAME_MAX = 80

export const createPartnerApiKeySchema = z.object({
  name: requiredText("Name", PARTNER_API_KEY_NAME_MAX),
  scopes: z
    .array(z.enum(PARTNER_API_SCOPES))
    .min(1, "Select at least one scope")
    .transform((scopes) => PARTNER_API_SCOPES.filter((scope) => scopes.includes(scope))),
})

export type CreatePartnerApiKeyInput = z.infer<typeof createPartnerApiKeySchema>
