import type Stripe from "stripe"

/**
 * The one seam every Stripe call goes through (lane note for the C tasks): a
 * real adapter over the Stripe SDK and an in-memory fake for tests. C4 needs
 * the Stripe Identity part; C5/C6 add customers, intents and refunds here.
 *
 * Free of side effects: this module never instantiates the SDK, so the
 * fake can be imported by tests without Stripe keys. The live instance is
 * `stripeGateway` in `@/lib/integrations/stripe`.
 */
export type StripeGateway = {
  identity: {
    createVerificationSession(
      params: Stripe.Identity.VerificationSessionCreateParams
    ): Promise<Stripe.Identity.VerificationSession>
    retrieveVerificationSession(id: string): Promise<Stripe.Identity.VerificationSession>
    retrieveVerificationReport(id: string): Promise<Stripe.Identity.VerificationReport>
  }
}

/** Identity runs on the PLATFORM account: no `stripeAccount` option is ever passed. */
export function createStripeGateway(client: Stripe): StripeGateway {
  return {
    identity: {
      createVerificationSession: (params) => client.identity.verificationSessions.create(params),
      retrieveVerificationSession: (id) => client.identity.verificationSessions.retrieve(id),
      retrieveVerificationReport: (id) => client.identity.verificationReports.retrieve(id),
    },
  }
}

type LastErrorCode = NonNullable<NonNullable<Stripe.Identity.VerificationSession["last_error"]>["code"]>

export type FakeVerificationOutcome =
  | { status: "verified" }
  | { status: "requires_input"; errorCode: LastErrorCode; reason?: string }
  | { status: "processing" }
  | { status: "canceled" }

export type InMemoryStripeGateway = StripeGateway & {
  /** Every create call, in order, exactly as the code under test sent it. */
  readonly createdSessions: Stripe.Identity.VerificationSessionCreateParams[]
  readonly reportRequests: string[]
  /** Moves a session to a final state like Stripe would, with a matching VerificationReport. */
  simulateOutcome(sessionId: string, outcome: FakeVerificationOutcome): Stripe.Identity.VerificationSession
  /** Makes report retrieval fail (network error / missing permission). */
  failReportRetrieval(enabled?: boolean): void
}

class FakeStripeError extends Error {
  readonly type = "StripeInvalidRequestError"
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
  }
}

const SELFIE_CODES = new Set<string>([
  "selfie_document_missing_photo",
  "selfie_face_mismatch",
  "selfie_manipulated",
  "selfie_unverified_other",
])

/** In-memory Stripe Identity: no network, deterministic ids (`vs_fake_1`, `vr_fake_1`…). */
export function createInMemoryStripeGateway(): InMemoryStripeGateway {
  const sessions = new Map<string, Stripe.Identity.VerificationSession>()
  const reports = new Map<string, Stripe.Identity.VerificationReport>()
  const createdSessions: Stripe.Identity.VerificationSessionCreateParams[] = []
  const reportRequests: string[] = []
  let sequence = 0
  let reportsFail = false

  function requireSession(id: string) {
    const session = sessions.get(id)

    if (!session) {
      throw new FakeStripeError(`No such verification_session: '${id}'`, "resource_missing")
    }

    return session
  }

  function buildReport(
    session: Stripe.Identity.VerificationSession,
    outcome: FakeVerificationOutcome
  ): Stripe.Identity.VerificationReport {
    const selfieRequested = session.options?.document?.require_matching_selfie === true
    const failed = outcome.status === "requires_input" ? outcome : null
    const selfieFailed = failed !== null && SELFIE_CODES.has(failed.errorCode)
    const documentFailed = failed !== null && !selfieFailed
    const error = (code: string, reason?: string) => ({ code, reason: reason ?? code }) as never

    return {
      id: `vr_fake_${++sequence}`,
      object: "identity.verification_report",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      type: "document",
      verification_session: session.id,
      options: session.options ?? {},
      client_reference_id: null,
      document: {
        status: documentFailed ? "unverified" : "verified",
        error: documentFailed ? error(failed.errorCode, failed.reason) : null,
      } as Stripe.Identity.VerificationReport["document"],
      selfie: selfieRequested
        ? ({
            status: selfieFailed ? "unverified" : "verified",
            error: selfieFailed ? error(failed.errorCode, failed.reason) : null,
            document: null,
            selfie: null,
          } as Stripe.Identity.VerificationReport["selfie"])
        : undefined,
    } as Stripe.Identity.VerificationReport
  }

  return {
    createdSessions,
    reportRequests,
    identity: {
      async createVerificationSession(params) {
        createdSessions.push(structuredClone(params))
        const id = `vs_fake_${++sequence}`
        const session = {
          id,
          object: "identity.verification_session",
          client_secret: `${id}_secret_fake`,
          created: Math.floor(Date.now() / 1000),
          last_error: null,
          last_verification_report: null,
          livemode: false,
          metadata: { ...(params.metadata ?? {}) },
          options: params.options ? structuredClone(params.options) : {},
          redaction: null,
          status: "requires_input",
          type: params.type ?? "document",
          url: `https://verify.stripe.com/start/test_${id}`,
        } as unknown as Stripe.Identity.VerificationSession
        sessions.set(id, session)
        return structuredClone(session)
      },
      async retrieveVerificationSession(id) {
        return structuredClone(requireSession(id))
      },
      async retrieveVerificationReport(id) {
        reportRequests.push(id)

        if (reportsFail) {
          throw new FakeStripeError("Simulated report retrieval failure", "api_error")
        }

        const report = reports.get(id)

        if (!report) {
          throw new FakeStripeError(`No such verification_report: '${id}'`, "resource_missing")
        }

        return structuredClone(report)
      },
    },
    simulateOutcome(sessionId, outcome) {
      const session = requireSession(sessionId)
      const report = outcome.status === "verified" || outcome.status === "requires_input" ? buildReport(session, outcome) : null

      if (report) {
        reports.set(report.id, report)
      }

      const next = {
        ...session,
        status: outcome.status,
        last_error:
          outcome.status === "requires_input"
            ? { code: outcome.errorCode, reason: outcome.reason ?? outcome.errorCode }
            : null,
        last_verification_report: report?.id ?? session.last_verification_report,
      } as Stripe.Identity.VerificationSession
      sessions.set(sessionId, next)
      return structuredClone(next)
    },
    failReportRetrieval(enabled = true) {
      reportsFail = enabled
    },
  }
}
