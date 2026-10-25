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
/**
 * Saved-card and charge calls run on the vendor's CONNECTED account (direct
 * charges): `account` is its `acct_` id. `idempotencyKey` is passed on creates
 * and captures so a retried request never charges twice.
 */
export type StripeConnectedCall = { account: string; idempotencyKey?: string }

export type StripeGateway = {
  payments: {
    createCustomer(params: Stripe.CustomerCreateParams, call: StripeConnectedCall): Promise<Stripe.Customer>
    createSetupIntent(params: Stripe.SetupIntentCreateParams, call: StripeConnectedCall): Promise<Stripe.SetupIntent>
    retrieveSetupIntent(id: string, call: StripeConnectedCall): Promise<Stripe.SetupIntent>
    createPaymentIntent(params: Stripe.PaymentIntentCreateParams, call: StripeConnectedCall): Promise<Stripe.PaymentIntent>
    retrievePaymentIntent(id: string, call: StripeConnectedCall): Promise<Stripe.PaymentIntent>
    capturePaymentIntent(id: string, params: Stripe.PaymentIntentCaptureParams, call: StripeConnectedCall): Promise<Stripe.PaymentIntent>
    cancelPaymentIntent(id: string, call: StripeConnectedCall): Promise<Stripe.PaymentIntent>
    retrievePaymentMethod(id: string, call: StripeConnectedCall): Promise<Stripe.PaymentMethod>
    detachPaymentMethod(id: string, call: StripeConnectedCall): Promise<Stripe.PaymentMethod>
    createRefund(params: Stripe.RefundCreateParams, call: StripeConnectedCall): Promise<Stripe.Refund>
  }
  identity: {
    createVerificationSession(
      params: Stripe.Identity.VerificationSessionCreateParams
    ): Promise<Stripe.Identity.VerificationSession>
    retrieveVerificationSession(id: string): Promise<Stripe.Identity.VerificationSession>
    retrieveVerificationReport(id: string): Promise<Stripe.Identity.VerificationReport>
  }
}

function connected(call: StripeConnectedCall): Stripe.RequestOptions {
  return { stripeAccount: call.account, ...(call.idempotencyKey ? { idempotencyKey: call.idempotencyKey } : {}) }
}

/** Identity runs on the PLATFORM account (no `stripeAccount`); payments run on the connected account. */
export function createStripeGateway(client: Stripe): StripeGateway {
  return {
    payments: {
      createCustomer: (params, call) => client.customers.create(params, connected(call)),
      createSetupIntent: (params, call) => client.setupIntents.create(params, connected(call)),
      retrieveSetupIntent: (id, call) => client.setupIntents.retrieve(id, {}, connected(call)),
      createPaymentIntent: (params, call) => client.paymentIntents.create(params, connected(call)),
      retrievePaymentIntent: (id, call) => client.paymentIntents.retrieve(id, {}, connected(call)),
      capturePaymentIntent: (id, params, call) => client.paymentIntents.capture(id, params, connected(call)),
      cancelPaymentIntent: (id, call) => client.paymentIntents.cancel(id, {}, connected(call)),
      retrievePaymentMethod: (id, call) => client.paymentMethods.retrieve(id, {}, connected(call)),
      detachPaymentMethod: (id, call) => client.paymentMethods.detach(id, {}, connected(call)),
      createRefund: (params, call) => client.refunds.create(params, connected(call)),
    },
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
  /** Saved-card and charge objects per connected account, and the browser confirm step. */
  readonly paymentsFake: InMemoryPayments
  /** Every create call, in order, exactly as the code under test sent it. */
  readonly createdSessions: Stripe.Identity.VerificationSessionCreateParams[]
  readonly reportRequests: string[]
  /** Moves a session to a final state like Stripe would, with a matching VerificationReport. */
  simulateOutcome(sessionId: string, outcome: FakeVerificationOutcome): Stripe.Identity.VerificationSession
  /** Makes report retrieval fail (network error / missing permission). */
  failReportRetrieval(enabled?: boolean): void
}

class FakeStripeError extends Error {
  readonly type: string = "StripeInvalidRequestError"
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message)
  }
}

/** Shaped like `Stripe.errors.StripeCardError`: `code`, `decline_code` and the failed `payment_intent`. */
export class FakeStripeCardError extends FakeStripeError {
  override readonly type = "StripeCardError"
  constructor(
    message: string,
    code: string,
    readonly decline_code: string | undefined,
    readonly payment_intent?: Stripe.PaymentIntent
  ) {
    super(message, code)
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

  const paymentsFake = createInMemoryPayments()

  return {
    paymentsFake,
    payments: paymentsFake.api,
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

// ── In-memory saved cards and charges ───────────────────────────────────────

type FakeCardOutcome = { ok: true } | { ok: false; code: string; declineCode: string; message: string }

/**
 * How Stripe's test payment methods behave (Spec v2.1 appendix). `setup`: when
 * the card is saved or paid on session (after any 3DS). `offSession`: later
 * merchant-initiated charges.
 */
type FakeCardBehaviour = { brand: string; last4: string; setup: FakeCardOutcome; offSession: FakeCardOutcome }

export const FAKE_TEST_CARDS = {
  // 4242 4242 4242 4242
  pm_card_visa: { brand: "visa", last4: "4242", setup: { ok: true }, offSession: { ok: true } },
  // 4000 0025 0000 3155: 3DS at setup, then off-session charges succeed
  pm_card_threeDSecure2Required: { brand: "visa", last4: "3155", setup: { ok: true }, offSession: { ok: true } },
  // 4000 0027 6000 3184: 3DS on every payment
  pm_card_authenticationRequired: {
    brand: "visa",
    last4: "3184",
    setup: { ok: true },
    offSession: { ok: false, code: "authentication_required", declineCode: "authentication_required", message: "This payment requires authentication." },
  },
  // 4000 0000 0000 0341: saves fine, later charges declined
  pm_card_chargeCustomerFail: {
    brand: "visa",
    last4: "0341",
    setup: { ok: true },
    offSession: { ok: false, code: "card_declined", declineCode: "generic_decline", message: "Your card was declined." },
  },
  // 4000 0000 0000 0069: expired card, declined at setup
  pm_card_chargeDeclinedExpiredCard: {
    brand: "visa",
    last4: "0069",
    setup: { ok: false, code: "expired_card", declineCode: "expired_card", message: "Your card has expired." },
    offSession: { ok: false, code: "expired_card", declineCode: "expired_card", message: "Your card has expired." },
  },
  // 4000 0000 0000 9995: insufficient funds, declined at setup
  pm_card_chargeDeclinedInsufficientFunds: {
    brand: "visa",
    last4: "9995",
    setup: { ok: false, code: "card_declined", declineCode: "insufficient_funds", message: "Your card has insufficient funds." },
    offSession: { ok: false, code: "card_declined", declineCode: "insufficient_funds", message: "Your card has insufficient funds." },
  },
} satisfies Record<string, FakeCardBehaviour>

export type FakeTestCard = keyof typeof FAKE_TEST_CARDS

export type InMemoryPayments = {
  api: StripeGateway["payments"]
  /** Every call as the code under test sent it, in order. */
  readonly calls: { method: string; account: string; idempotencyKey?: string; params?: unknown }[]
  /** What the browser does with the client secret (confirmCardSetup / confirmPayment), after any 3DS. */
  confirmOnSession(kind: "setup_intent" | "payment_intent", id: string, account: string, paymentMethod: FakeTestCard): Stripe.SetupIntent | Stripe.PaymentIntent
  customers(account: string): Stripe.Customer[]
  paymentMethod(account: string, id: string): Stripe.PaymentMethod | undefined
}

/** In-memory Stripe for saved cards and charges: per-account objects, idempotency keys, test-card outcomes. */
export function createInMemoryPayments(): InMemoryPayments {
  const objects = new Map<string, unknown>()
  const idempotent = new Map<string, unknown>()
  const calls: InMemoryPayments["calls"] = []
  let sequence = 0
  const now = () => Math.floor(Date.now() / 1000)
  const slotOf = (account: string, id: string) => `${account}:${id}`

  function store<T extends { id: string }>(account: string, object: T): T {
    objects.set(slotOf(account, object.id), object)
    return structuredClone(object)
  }

  function load<T>(account: string, id: string, label: string): T {
    const object = objects.get(slotOf(account, id))

    if (!object) {
      // Stripe answers the same for an id that exists on another account.
      throw new FakeStripeError(`No such ${label}: '${id}'`, "resource_missing")
    }

    return object as T
  }

  function once<T>(method: string, call: StripeConnectedCall, params: unknown, create: () => T): T {
    calls.push({ method, account: call.account, idempotencyKey: call.idempotencyKey, params: structuredClone(params) })

    if (!call.idempotencyKey) {
      return create()
    }

    const slot = `${call.account}:${method}:${call.idempotencyKey}`

    if (!idempotent.has(slot)) {
      idempotent.set(slot, create())
    }

    return structuredClone(idempotent.get(slot)) as T
  }

  function behaviourOf(id: string): FakeCardBehaviour {
    const behaviour = (FAKE_TEST_CARDS as Record<string, FakeCardBehaviour>)[id]

    if (!behaviour) {
      throw new FakeStripeError(`No such PaymentMethod: '${id}'`, "resource_missing")
    }

    return behaviour
  }

  function card(account: string, id: string): Stripe.PaymentMethod {
    const behaviour = behaviourOf(id)
    const existing = objects.get(slotOf(account, id)) as Stripe.PaymentMethod | undefined

    return (
      existing ??
      store(account, {
        id,
        object: "payment_method",
        type: "card",
        customer: null,
        card: { brand: behaviour.brand, last4: behaviour.last4, exp_month: 12, exp_year: new Date().getFullYear() + 3 },
        created: now(),
        livemode: false,
        metadata: {},
      } as unknown as Stripe.PaymentMethod)
    )
  }

  function idOf(value: string | { id: string } | null | undefined) {
    return typeof value === "string" ? value : (value?.id ?? null)
  }

  function attach(account: string, paymentMethodId: string, customer: string | null) {
    if (!customer) return
    const pm = load<Stripe.PaymentMethod>(account, paymentMethodId, "PaymentMethod")
    objects.set(slotOf(account, paymentMethodId), { ...pm, customer })
  }

  function cardError(outcome: Exclude<FakeCardOutcome, { ok: true }>) {
    return { code: outcome.code, decline_code: outcome.declineCode, message: outcome.message, type: "card_error" }
  }

  function succeed(account: string, intent: Stripe.PaymentIntent) {
    const manual = intent.capture_method === "manual"
    const next = {
      ...intent,
      status: manual ? "requires_capture" : "succeeded",
      amount_capturable: manual ? intent.amount : 0,
      amount_received: manual ? 0 : intent.amount,
      last_payment_error: null,
    } as Stripe.PaymentIntent

    if (intent.setup_future_usage) attach(account, idOf(intent.payment_method)!, idOf(intent.customer))
    return store(account, next)
  }

  /** Off-session confirm at creation: the outcome follows the card's `offSession` behaviour. */
  function confirmOffSession(account: string, intent: Stripe.PaymentIntent) {
    const pmId = idOf(intent.payment_method)

    if (!pmId) {
      throw new FakeStripeError("You must provide a payment method to confirm off session.", "parameter_missing")
    }

    card(account, pmId)
    const outcome = behaviourOf(pmId).offSession

    if (!outcome.ok) {
      const failed = {
        ...intent,
        status: outcome.code === "authentication_required" ? "requires_action" : "requires_payment_method",
        last_payment_error: cardError(outcome),
      } as unknown as Stripe.PaymentIntent
      store(account, failed)
      throw new FakeStripeCardError(outcome.message, outcome.code, outcome.declineCode, structuredClone(failed))
    }

    return succeed(account, intent)
  }

  const api: StripeGateway["payments"] = {
    async createCustomer(params, call) {
      return once("createCustomer", call, params, () =>
        store(call.account, {
          id: `cus_fake_${++sequence}`,
          object: "customer",
          email: params.email ?? null,
          name: params.name ?? null,
          phone: params.phone ?? null,
          metadata: { ...(params.metadata ?? {}) },
          created: now(),
          livemode: false,
        } as unknown as Stripe.Customer)
      )
    },
    async createSetupIntent(params, call) {
      return once("createSetupIntent", call, params, () => {
        const id = `seti_fake_${++sequence}`
        return store(call.account, {
          id,
          object: "setup_intent",
          client_secret: `${id}_secret_fake`,
          customer: params.customer ?? null,
          usage: params.usage ?? "off_session",
          payment_method: null,
          payment_method_types: params.payment_method_types ?? ["card"],
          status: "requires_payment_method",
          last_setup_error: null,
          metadata: { ...(params.metadata ?? {}) },
          created: now(),
          livemode: false,
        } as unknown as Stripe.SetupIntent)
      })
    },
    async retrieveSetupIntent(id, call) {
      calls.push({ method: "retrieveSetupIntent", account: call.account, params: id })
      return structuredClone(load<Stripe.SetupIntent>(call.account, id, "setup_intent"))
    },
    async createPaymentIntent(params, call) {
      return once("createPaymentIntent", call, params, () => {
        const id = `pi_fake_${++sequence}`
        const intent = store(call.account, {
          id,
          object: "payment_intent",
          client_secret: `${id}_secret_fake`,
          amount: params.amount,
          amount_capturable: 0,
          amount_received: 0,
          currency: params.currency,
          customer: params.customer ?? null,
          payment_method: params.payment_method ?? null,
          capture_method: params.capture_method ?? "automatic_async",
          setup_future_usage: params.setup_future_usage ?? null,
          status: "requires_payment_method",
          last_payment_error: null,
          metadata: { ...(params.metadata ?? {}) },
          description: params.description ?? null,
          created: now(),
          livemode: false,
        } as unknown as Stripe.PaymentIntent)

        return params.confirm && params.off_session ? confirmOffSession(call.account, intent) : intent
      })
    },
    async retrievePaymentIntent(id, call) {
      calls.push({ method: "retrievePaymentIntent", account: call.account, params: id })
      return structuredClone(load<Stripe.PaymentIntent>(call.account, id, "payment_intent"))
    },
    async capturePaymentIntent(id, params, call) {
      return once("capturePaymentIntent", call, { id, ...params }, () => {
        const intent = load<Stripe.PaymentIntent>(call.account, id, "payment_intent")

        if (intent.status !== "requires_capture") {
          throw new FakeStripeError(`This PaymentIntent could not be captured because it has a status of ${intent.status}.`, "payment_intent_unexpected_state")
        }

        const amount = params.amount_to_capture ?? intent.amount_capturable

        if (amount > intent.amount_capturable) {
          throw new FakeStripeError("The amount to capture must be less than or equal to the amount capturable.", "amount_too_large")
        }

        return store(call.account, { ...intent, status: "succeeded", amount_received: amount, amount_capturable: 0 } as Stripe.PaymentIntent)
      })
    },
    async cancelPaymentIntent(id, call) {
      calls.push({ method: "cancelPaymentIntent", account: call.account, params: id })
      const intent = load<Stripe.PaymentIntent>(call.account, id, "payment_intent")

      if (intent.status === "succeeded" || intent.status === "canceled") {
        throw new FakeStripeError(`You cannot cancel this PaymentIntent because it has a status of ${intent.status}.`, "payment_intent_unexpected_state")
      }

      return store(call.account, { ...intent, status: "canceled", amount_capturable: 0 } as Stripe.PaymentIntent)
    },
    async retrievePaymentMethod(id, call) {
      calls.push({ method: "retrievePaymentMethod", account: call.account, params: id })
      return structuredClone(load<Stripe.PaymentMethod>(call.account, id, "PaymentMethod"))
    },
    async detachPaymentMethod(id, call) {
      calls.push({ method: "detachPaymentMethod", account: call.account, params: id })
      const pm = load<Stripe.PaymentMethod>(call.account, id, "PaymentMethod")

      if (!pm.customer) {
        throw new FakeStripeError("The payment method you provided is not attached to a customer so detachment is impossible.", "payment_method_unexpected_state")
      }

      return store(call.account, { ...pm, customer: null } as Stripe.PaymentMethod)
    },
    async createRefund(params, call) {
      return once("createRefund", call, params, () => {
        const intentId = idOf(params.payment_intent as string | undefined)

        if (!intentId) {
          throw new FakeStripeError("You must provide a payment_intent to refund.", "parameter_missing")
        }

        const intent = load<Stripe.PaymentIntent>(call.account, intentId, "payment_intent")
        const refunded = Number(intent.metadata?.fakeRefunded ?? 0)
        const amount = params.amount ?? intent.amount_received - refunded

        if (intent.status !== "succeeded" || amount <= 0 || refunded + amount > intent.amount_received) {
          throw new FakeStripeError("Refund amount is greater than the unrefunded amount on the charge.", "amount_too_large")
        }

        store(call.account, { ...intent, metadata: { ...intent.metadata, fakeRefunded: String(refunded + amount) } } as Stripe.PaymentIntent)
        return store(call.account, {
          id: `re_fake_${++sequence}`,
          object: "refund",
          amount,
          currency: intent.currency,
          payment_intent: intent.id,
          reason: params.reason ?? null,
          status: "succeeded",
          metadata: { ...(params.metadata ?? {}) },
          created: now(),
        } as unknown as Stripe.Refund)
      })
    },
  }

  return {
    api,
    calls,
    confirmOnSession(kind, id, account, paymentMethod) {
      const pm = card(account, paymentMethod)
      const outcome = behaviourOf(paymentMethod).setup

      if (kind === "setup_intent") {
        const intent = load<Stripe.SetupIntent>(account, id, "setup_intent")

        if (!outcome.ok) {
          return store(account, { ...intent, status: "requires_payment_method", payment_method: null, last_setup_error: cardError(outcome) } as unknown as Stripe.SetupIntent)
        }

        attach(account, pm.id, idOf(intent.customer))
        return store(account, { ...intent, status: "succeeded", payment_method: pm.id, last_setup_error: null } as Stripe.SetupIntent)
      }

      const intent = load<Stripe.PaymentIntent>(account, id, "payment_intent")

      if (!outcome.ok) {
        return store(account, { ...intent, status: "requires_payment_method", last_payment_error: cardError(outcome) } as unknown as Stripe.PaymentIntent)
      }

      return succeed(account, { ...intent, payment_method: pm.id } as Stripe.PaymentIntent)
    },
    customers(account) {
      return [...objects.entries()]
        .filter(([slot, value]) => slot.startsWith(`${account}:`) && (value as { object?: string }).object === "customer")
        .map(([, value]) => structuredClone(value as Stripe.Customer))
    },
    paymentMethod(account, id) {
      const pm = objects.get(slotOf(account, id)) as Stripe.PaymentMethod | undefined
      return pm ? structuredClone(pm) : undefined
    },
  }
}
