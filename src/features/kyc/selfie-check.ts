import type Stripe from "stripe"

import type { StripeGateway } from "@/lib/integrations/stripe-gateway"

/**
 * Stripe Identity selfie matching (C4). Option names and error codes follow the
 * Stripe API reference (VerificationSession create → `options.document`,
 * VerificationReport → `selfie.status` / `selfie.error.code`).
 *
 * Client-safe: only type imports, so the dashboard can share the codes.
 */

/** Document types accepted when a selfie is required: each carries a face photo to match against. */
export const SELFIE_ALLOWED_DOCUMENT_TYPES = ["driving_license", "id_card", "passport"] as const

/** Selfie check failure codes documented by Stripe Identity. */
export const SELFIE_ERROR_CODES = [
  "selfie_document_missing_photo",
  "selfie_face_mismatch",
  "selfie_manipulated",
  "selfie_unverified_other",
] as const

export type SelfieErrorCode = (typeof SELFIE_ERROR_CODES)[number]

/** Same values as the Prisma `KycSelfieCheck` enum. */
export type SelfieCheckValue = "NOT_REQUESTED" | "VERIFIED" | "UNVERIFIED"

export type SelfieOutcome = {
  selfieCheck: SelfieCheckValue
  selfieErrorCode: string | null
}

export const SELFIE_NOT_REQUESTED: SelfieOutcome = Object.freeze({ selfieCheck: "NOT_REQUESTED", selfieErrorCode: null })

export function isSelfieErrorCode(code: unknown): code is SelfieErrorCode {
  return typeof code === "string" && (SELFIE_ERROR_CODES as readonly string[]).includes(code)
}

/**
 * Parameters of the hosted Stripe Identity session. Without a selfie the
 * request is exactly what it was before C4 (no `options` key at all).
 */
export function buildIdentityVerificationSessionParams(input: {
  returnUrl: string
  metadata: Record<string, string>
  requireSelfie: boolean
}): Stripe.Identity.VerificationSessionCreateParams {
  const params: Stripe.Identity.VerificationSessionCreateParams = {
    type: "document",
    return_url: input.returnUrl,
    metadata: input.metadata,
  }

  if (!input.requireSelfie) {
    return params
  }

  return {
    ...params,
    options: {
      document: {
        require_matching_selfie: true,
        require_live_capture: true,
        allowed_types: [...SELFIE_ALLOWED_DOCUMENT_TYPES],
      },
    },
  }
}

/** The session itself records whether a selfie was asked for, whatever the transaction says today. */
export function isSelfieRequested(session: Pick<Stripe.Identity.VerificationSession, "options">) {
  return session.options?.document?.require_matching_selfie === true
}

type ReportSelfie = { status: string; error?: { code?: string | null } | null } | null | undefined

/**
 * Pure mapping from what Stripe returned to the stored selfie outcome.
 * Returns null while there is no outcome yet (`processing`), so callers keep
 * whatever is stored.
 */
export function mapSelfieOutcome(input: {
  requested: boolean
  sessionStatus: Stripe.Identity.VerificationSession["status"]
  lastErrorCode: string | null | undefined
  reportSelfie?: ReportSelfie
}): SelfieOutcome | null {
  if (!input.requested) {
    return { ...SELFIE_NOT_REQUESTED }
  }

  const lastErrorCode = input.lastErrorCode ?? null

  if (input.reportSelfie?.status === "verified") {
    return { selfieCheck: "VERIFIED", selfieErrorCode: null }
  }

  if (input.reportSelfie?.status === "unverified") {
    return { selfieCheck: "UNVERIFIED", selfieErrorCode: input.reportSelfie.error?.code ?? lastErrorCode }
  }

  switch (input.sessionStatus) {
    // A session that asked for a selfie is only `verified` when both the
    // document and the selfie checks passed.
    case "verified":
      return { selfieCheck: "VERIFIED", selfieErrorCode: null }
    case "requires_input":
    case "canceled":
      return { selfieCheck: "UNVERIFIED", selfieErrorCode: lastErrorCode }
    case "processing":
    default:
      return null
  }
}

/**
 * Selfie outcome of a finished session. For a failed session the
 * VerificationReport is read for the selfie's own status (the session's
 * `last_error` only names the first failing check); if the report cannot be
 * read, `last_error` is used.
 */
export async function resolveSelfieOutcome(
  session: Stripe.Identity.VerificationSession,
  gateway: StripeGateway
): Promise<SelfieOutcome | null> {
  const requested = isSelfieRequested(session)
  let reportSelfie: ReportSelfie = null

  if (requested && session.status !== "verified" && session.last_verification_report) {
    const reportRef = session.last_verification_report

    try {
      const report =
        typeof reportRef === "string" ? await gateway.identity.retrieveVerificationReport(reportRef) : reportRef
      reportSelfie = report.selfie ?? null
    } catch (error) {
      console.warn("Stripe Identity report unavailable, using the session error for the selfie outcome.", {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return mapSelfieOutcome({
    requested,
    sessionStatus: session.status,
    lastErrorCode: session.last_error?.code ?? null,
    reportSelfie,
  })
}
