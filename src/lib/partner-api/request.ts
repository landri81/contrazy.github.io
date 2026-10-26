import type { z } from "zod"

import { PartnerApiError } from "@/lib/partner-api/errors"

/** Reads a JSON request body; anything that is not a JSON object is a 400 `invalid_request`. */
export async function readPartnerJsonBody(request: Request): Promise<unknown> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw new PartnerApiError("invalid_request", "The request body must be valid JSON.")
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PartnerApiError("invalid_request", "The request body must be a JSON object.")
  }

  return body
}

/** `{ path, message }` for the first zod issues, returned in `error.details.issues`. */
export function formatPartnerValidationIssues(error: z.ZodError) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }))
}

/** Validates a body with a zod schema; refusals are 400 `invalid_request` listing every issue. */
export function parsePartnerBody<TSchema extends z.ZodType>(schema: TSchema, body: unknown): z.output<TSchema> {
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    const issues = formatPartnerValidationIssues(parsed.error)
    const first = issues[0]

    throw new PartnerApiError(
      "invalid_request",
      first ? (first.path ? `${first.path}: ${first.message}` : first.message) : "The request body is invalid.",
      { details: { issues } }
    )
  }

  return parsed.data
}
