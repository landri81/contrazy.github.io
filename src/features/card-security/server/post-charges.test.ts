/**
 * C6a: post-rental charges on the saved card (Spec v2.1 §7, §9, §13).
 * Spec §18 scenarios covered here (in-memory Stripe):
 *   #3 standard off-session charge (4242): charge OK
 *   #7 double click on "Charge": one charge (same idempotency key + one attempt in flight)
 *   #8 two damage charges on the same booking: two charges, no key collision
 *   #9 charge attempt after the 90-day window (D+95, and the exact boundary): refused
 * C6b (Spec §9 retry policy applied):
 *   #4 off-session charge needing 3DS (3184): authentication_required, no retry, payment link
 *   #5 card saved, then charge declined (0341): one retry at 72 h, then payment link
 */
import type { CardSecurity, PostCharge, PostChargeAttempt, Transaction, VendorProfile } from "@prisma/client"
import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

const recordChargeOutcomeEvent = vi.fn()
vi.mock("@/features/partner-webhooks/server/charge-events", () => ({
  recordChargeOutcomeEvent: (...args: unknown[]) => recordChargeOutcomeEvent(...args),
}))
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://app.contrazy.test" } }))

const { createPostCharge, attemptPostCharge, applyPostChargeIntent, isChargeWindowOpen, postChargeIdempotencyKey, PostChargeError, retryDuePostCharges, linkKindFor } = await import("./post-charges")
const { createInMemoryStripeGateway } = await import("@/lib/integrations/stripe-gateway")

const ACCOUNT = "acct_locaz_test"
const DAY = 86_400_000
const RETURNED = new Date("2026-11-05T17:00:00Z")
const WINDOW_END = new Date(RETURNED.getTime() + 90 * DAY)

function createDb(card: CardSecurity | null = null) {
  const charges: PostCharge[] = []
  const attempts: PostChargeAttempt[] = []
  let seq = 0
  const db = {
    charges,
    attempts,
    postCharge: {
      async create({ data }: { data: Partial<PostCharge> }) {
        const row = { id: `pc_${++seq}`, status: "PENDING", attempt: 0, paymentIntentId: null, declineCode: null, nextRetryAt: null, paymentLinkToken: null, reviewFlag: false, refundedAmount: 0, succeededAt: null, createdAt: new Date(), updatedAt: new Date(), ...data } as PostCharge
        charges.push(row)
        return { ...row }
      },
      async findUnique({ where }: { where: { id?: string; transactionId_externalRef?: { transactionId: string; externalRef: string } } }) {
        const found = where.id
          ? charges.find((c) => c.id === where.id)
          : charges.find((c) => c.transactionId === where.transactionId_externalRef!.transactionId && c.externalRef === where.transactionId_externalRef!.externalRef)
        return found ? { ...found } : null
      },
      async updateMany({ where, data }: { where: { id: string; status: { in: string[] }; attempt: number }; data: Partial<PostCharge> }) {
        const row = charges.find((c) => c.id === where.id && where.status.in.includes(c.status) && c.attempt === where.attempt)
        if (row) Object.assign(row, data)
        return { count: row ? 1 : 0 }
      },
      async update({ where, data }: { where: { id: string }; data: Partial<PostCharge> }) {
        return { ...Object.assign(charges.find((c) => c.id === where.id)!, data) }
      },
      async findMany({ where }: { where: { status: string; nextRetryAt: { lte: Date } } }) {
        return charges
          .filter((c) => c.status === where.status && c.nextRetryAt && c.nextRetryAt <= where.nextRetryAt.lte)
          .map((c) => ({ ...c, transaction: { reference: "TX-1", cardSecurity: card, vendor: { stripeAccountId: ACCOUNT } } }))
      },
    },
    transaction: {
      async findUnique() {
        return { locale: "fr" }
      },
    },
    postChargeAttempt: {
      async upsert({ where, create, update }: { where: { idempotencyKey: string }; create: Partial<PostChargeAttempt>; update: Partial<PostChargeAttempt> }) {
        const existing = attempts.find((a) => a.idempotencyKey === where.idempotencyKey)
        if (existing) return Object.assign(existing, update)
        const row = { id: `pca_${++seq}`, createdAt: new Date(), ...create } as PostChargeAttempt
        attempts.push(row)
        return row
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
      return fn(db)
    },
  }
  return db
}

function booking(card: Partial<CardSecurity> | null = {}) {
  return {
    id: "tx1",
    vendorId: "v1",
    reference: "TX-1",
    currency: "EUR",
    vendor: { stripeAccountId: ACCOUNT } as VendorProfile,
    cardSecurity: card === null ? null : ({ status: "SECURED", stripeCustomerId: "cus_1", paymentMethodId: "pm_card_visa", windowEndsAt: WINDOW_END, ...card } as CardSecurity),
  } as unknown as Transaction & { vendor: VendorProfile; cardSecurity: CardSecurity | null }
}

const damage = { type: "DAMAGE" as const, amount: 25000, description: "Rear bumper scratch" }

beforeEach(() => recordChargeOutcomeEvent.mockReset())

describe("charging the saved card (Spec §18 #3)", () => {
  it("charges off session with the attempt's idempotency key and records the outcome", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const charge = await createPostCharge(db as never, gateway, { transaction: booking(), charge: { ...damage, externalRef: "LZ-DMG-1" }, now: new Date("2026-11-20T10:00:00Z") })

    expect(charge).toMatchObject({ status: "SUCCEEDED", attempt: 1, declineCode: null, amount: 25000, externalRef: "LZ-DMG-1" })
    expect(postChargeIdempotencyKey(charge.id, 1)).toBe(`postcharge_${charge.id}_attempt_1`)
    expect(gateway.paymentsFake.calls.find((c) => c.method === "createPaymentIntent")).toMatchObject({
      account: ACCOUNT,
      idempotencyKey: `postcharge_${charge.id}_attempt_1`,
      params: { amount: 25000, currency: "eur", customer: "cus_1", payment_method: "pm_card_visa", off_session: true, confirm: true, metadata: { postChargeId: charge.id, chargeType: "damage", attempt: "1" } },
    })
    // Never a rental payment or a deposit: no financeStage on charge intents.
    expect((gateway.paymentsFake.calls[0].params as { metadata: Record<string, string> }).metadata.financeStage).toBeUndefined()
    expect(db.attempts).toEqual([expect.objectContaining({ attemptNo: 1, idempotencyKey: `postcharge_${charge.id}_attempt_1`, outcome: "succeeded" })])
    expect(recordChargeOutcomeEvent).toHaveBeenCalledTimes(1)
    expect(recordChargeOutcomeEvent.mock.calls[0][1]).toMatchObject({ transactionId: "tx1", outcome: "succeeded", charge: { id: charge.id, type: "damage", amount: 25000, attempt: 1 } })
  })

  it("requires the notice for FPS, tolls and towing, not for damage", async () => {
    for (const type of ["FPS", "TOLL", "TOWING"] as const) {
      await expect(createPostCharge(createDb() as never, createInMemoryStripeGateway(), { transaction: booking(), charge: { type, amount: 3500 } })).rejects.toMatchObject({ code: "proof_required" })
    }
    const fps = await createPostCharge(createDb() as never, createInMemoryStripeGateway(), { transaction: booking(), charge: { type: "FPS", amount: 3500, proofUrls: ["https://files.locaz.co/fps-0617.pdf"] }, now: RETURNED })
    expect(fps.status).toBe("SUCCEEDED")
  })

  it("refuses a booking without a saved card and a reference already used on the booking", async () => {
    await expect(createPostCharge(createDb() as never, createInMemoryStripeGateway(), { transaction: booking(null), charge: damage })).rejects.toMatchObject({ code: "card_not_secured" })
    await expect(createPostCharge(createDb() as never, createInMemoryStripeGateway(), { transaction: booking({ status: "DETACHED" }), charge: damage })).rejects.toMatchObject({ code: "card_not_secured" })

    const db = createDb()
    await createPostCharge(db as never, createInMemoryStripeGateway(), { transaction: booking(), charge: { ...damage, externalRef: "LZ-DMG-1" }, now: RETURNED })
    await expect(createPostCharge(db as never, createInMemoryStripeGateway(), { transaction: booking(), charge: { ...damage, externalRef: "LZ-DMG-1" }, now: RETURNED })).rejects.toMatchObject({ code: "external_ref_conflict" })
  })
})

describe("90-day window (Spec §18 #9)", () => {
  it("allows charges until the exact end of the window and refuses them one moment later and at D+95", async () => {
    expect(isChargeWindowOpen({ status: "SECURED", windowEndsAt: WINDOW_END }, WINDOW_END)).toBe(true)
    expect(isChargeWindowOpen({ status: "SECURED", windowEndsAt: WINDOW_END }, new Date(WINDOW_END.getTime() + 1))).toBe(false)
    expect(isChargeWindowOpen({ status: "SECURED", windowEndsAt: null }, new Date("2030-01-01"))).toBe(true)
    expect(isChargeWindowOpen({ status: "DETACHED", windowEndsAt: WINDOW_END }, RETURNED)).toBe(false)

    const gateway = createInMemoryStripeGateway()
    const error = await createPostCharge(createDb() as never, gateway, { transaction: booking(), charge: damage, now: new Date(RETURNED.getTime() + 95 * DAY) }).catch((e) => e)
    expect(error).toBeInstanceOf(PostChargeError)
    expect(error).toMatchObject({ code: "charge_window_closed", details: { windowEndsAt: WINDOW_END.toISOString() } })
    expect(gateway.paymentsFake.calls).toHaveLength(0)
  })
})

describe("one charge per row (Spec §18 #7, #8)", () => {
  it("never runs two attempts of the same charge at once", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const charge = await db.postCharge.create({ data: { transactionId: "tx1", vendorId: "v1", type: "DAMAGE", amount: 25000, currency: "EUR" } })
    db.charges[0].status = "PROCESSING"

    await expect(attemptPostCharge(db as never, gateway, { charge, card: booking().cardSecurity!, account: ACCOUNT, reference: "TX-1" })).rejects.toMatchObject({ code: "charge_in_flight" })
    expect(gateway.paymentsFake.calls).toHaveLength(0)
  })

  it("a re-sent attempt reuses its key, so Stripe returns the same charge", async () => {
    const gateway = createInMemoryStripeGateway()
    const params = { amount: 25000, currency: "eur", customer: "cus_1", payment_method: "pm_card_visa", off_session: true, confirm: true }
    const first = await gateway.payments.createPaymentIntent(params, { account: ACCOUNT, idempotencyKey: postChargeIdempotencyKey("pc_1", 1) })
    const again = await gateway.payments.createPaymentIntent(params, { account: ACCOUNT, idempotencyKey: postChargeIdempotencyKey("pc_1", 1) })
    expect(again.id).toBe(first.id)
  })

  it("two damage charges on the same booking are two rows with two keys and two charges", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const a = await createPostCharge(db as never, gateway, { transaction: booking(), charge: { ...damage, externalRef: "LZ-DMG-1" }, now: RETURNED })
    const b = await createPostCharge(db as never, gateway, { transaction: booking(), charge: { ...damage, amount: 12000, externalRef: "LZ-DMG-2" }, now: RETURNED })

    const keys = gateway.paymentsFake.calls.filter((c) => c.method === "createPaymentIntent").map((c) => c.idempotencyKey)
    expect(keys).toEqual([`postcharge_${a.id}_attempt_1`, `postcharge_${b.id}_attempt_1`])
    expect(a.paymentIntentId).not.toBe(b.paymentIntentId)
    expect([a.status, b.status]).toEqual(["SUCCEEDED", "SUCCEEDED"])
  })
})

describe("declined and unreachable", () => {
  it.each([
    ["pm_card_chargeCustomerFail", "FAILED", "generic_decline", "failed"],
    ["pm_card_authenticationRequired", "REQUIRES_ACTION", "authentication_required", "requires_action"],
  ] as const)("%s: %s with the decline code, event %s", async (pm, status, declineCode, outcome) => {
    const db = createDb()
    const charge = await createPostCharge(db as never, createInMemoryStripeGateway(), { transaction: booking({ paymentMethodId: pm }), charge: damage, now: RETURNED })

    expect(charge).toMatchObject({ status, declineCode, attempt: 1 })
    expect(charge.paymentIntentId).toMatch(/^pi_fake_/)
    expect(db.attempts[0]).toMatchObject({ outcome, declineCode })
    expect(recordChargeOutcomeEvent.mock.calls[0][1]).toMatchObject({ outcome, charge: { declineCode } })
  })

  it("#4 authentication_required: no off-session retry, a payment link for 3DS on session", async () => {
    const db = createDb()
    const charge = await createPostCharge(db as never, createInMemoryStripeGateway(), { transaction: booking({ paymentMethodId: "pm_card_authenticationRequired" }), charge: damage, now: RETURNED })

    expect(charge).toMatchObject({ status: "REQUIRES_ACTION", nextRetryAt: null })
    expect(charge.paymentLinkToken).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(linkKindFor(charge)).toBe("payment")
    expect(recordChargeOutcomeEvent.mock.calls[0][1].charge).toMatchObject({
      paymentLinkUrl: `https://app.contrazy.test/fr/pay/${charge.paymentLinkToken}`,
      cardUpdateUrl: null,
      nextRetryAt: null,
    })
  })

  it("#5 generic decline (0341): one off-session retry after 72 h, then a payment link", async () => {
    const card = booking({ paymentMethodId: "pm_card_chargeCustomerFail" }).cardSecurity!
    const db = createDb(card)
    const gateway = createInMemoryStripeGateway()
    const first = await createPostCharge(db as never, gateway, { transaction: booking({ paymentMethodId: "pm_card_chargeCustomerFail" }), charge: damage, now: RETURNED })

    expect(first).toMatchObject({ status: "FAILED", paymentLinkToken: null })
    expect(first.nextRetryAt).toEqual(new Date(RETURNED.getTime() + 72 * 3_600_000))
    expect(recordChargeOutcomeEvent.mock.calls[0][1].charge.nextRetryAt).toEqual(first.nextRetryAt)

    // Not due yet: nothing happens.
    expect(await retryDuePostCharges(db as never, gateway, new Date(RETURNED.getTime() + 71 * 3_600_000))).toMatchObject({ due: 0 })

    const run = await retryDuePostCharges(db as never, gateway, new Date(RETURNED.getTime() + 72 * 3_600_000))
    expect(run).toEqual({ due: 1, succeeded: 0, failed: 1, skipped: 0 })
    expect(db.charges[0]).toMatchObject({ status: "FAILED", attempt: 2, nextRetryAt: null })
    expect(db.charges[0].paymentLinkToken).toBeTruthy()
    expect(gateway.paymentsFake.calls.filter((c) => c.method === "createPaymentIntent").map((c) => c.idempotencyKey)).toEqual([
      `postcharge_${first.id}_attempt_1`,
      `postcharge_${first.id}_attempt_2`,
    ])
  })

  it("insufficient funds: retries after 24 h, 48 h and 72 h, then a payment link", async () => {
    const card = booking({ paymentMethodId: "pm_card_chargeDeclinedInsufficientFunds" }).cardSecurity!
    const db = createDb(card)
    const gateway = createInMemoryStripeGateway()
    await createPostCharge(db as never, gateway, { transaction: booking({ paymentMethodId: "pm_card_chargeDeclinedInsufficientFunds" }), charge: damage, now: RETURNED })
    let at = RETURNED.getTime()

    for (const hours of [24, 48, 72]) {
      expect(db.charges[0].nextRetryAt).toEqual(new Date(at + hours * 3_600_000))
      at += hours * 3_600_000
      await retryDuePostCharges(db as never, gateway, new Date(at))
    }

    expect(db.charges[0]).toMatchObject({ status: "FAILED", attempt: 4, nextRetryAt: null, declineCode: "insufficient_funds" })
    expect(linkKindFor(db.charges[0])).toBe("payment")
  })

  it("an expired card gets a card-update link instead of retries", async () => {
    const db = createDb()
    const charge = await createPostCharge(db as never, createInMemoryStripeGateway(), { transaction: booking({ paymentMethodId: "pm_card_chargeDeclinedExpiredCard" }), charge: damage, now: RETURNED })

    expect(charge).toMatchObject({ status: "FAILED", declineCode: "expired_card", nextRetryAt: null })
    expect(linkKindFor(charge)).toBe("card_update")
    expect(recordChargeOutcomeEvent.mock.calls[0][1].charge).toMatchObject({ paymentLinkUrl: null, cardUpdateUrl: `https://app.contrazy.test/fr/pay/${charge.paymentLinkToken}` })
  })

  it("keeps the attempt number when Stripe cannot be reached, so the retry sends the same key", async () => {
    const db = createDb()
    const gateway = createInMemoryStripeGateway()
    const charge = await db.postCharge.create({ data: { transactionId: "tx1", vendorId: "v1", type: "DAMAGE", amount: 25000, currency: "EUR" } })
    const original = gateway.payments.createPaymentIntent
    gateway.payments.createPaymentIntent = vi.fn().mockRejectedValueOnce(Object.assign(new Error("socket hang up"), { type: "StripeConnectionError" }))

    await expect(attemptPostCharge(db as never, gateway, { charge, card: booking().cardSecurity!, account: ACCOUNT, reference: "TX-1" })).rejects.toThrow("socket hang up")
    expect(db.charges[0]).toMatchObject({ status: "PENDING", attempt: 0 })

    gateway.payments.createPaymentIntent = original
    const settled = await attemptPostCharge(db as never, gateway, { charge: db.charges[0], card: booking().cardSecurity!, account: ACCOUNT, reference: "TX-1" })
    expect(settled).toMatchObject({ status: "SUCCEEDED", attempt: 1 })
    expect(gateway.paymentsFake.calls.find((c) => c.method === "createPaymentIntent")?.idempotencyKey).toBe(`postcharge_${charge.id}_attempt_1`)
  })
})

describe("Stripe webhooks for charge intents", () => {
  async function processingCharge(db: ReturnType<typeof createDb>) {
    await db.postCharge.create({ data: { transactionId: "tx1", vendorId: "v1", type: "TOLL", amount: 870, currency: "EUR", status: "PROCESSING", attempt: 1, paymentIntentId: "pi_async" } })
    return { id: "pi_async", metadata: { postChargeId: db.charges[0].id, attempt: "1" }, last_payment_error: null } as unknown as Stripe.PaymentIntent
  }

  it("settles a charge that was still processing", async () => {
    const db = createDb()
    const intent = await processingCharge(db)
    const settled = await applyPostChargeIntent(db as never, intent, "succeeded")

    expect(settled).toMatchObject({ status: "SUCCEEDED" })
    expect(recordChargeOutcomeEvent).toHaveBeenCalledTimes(1)
    // Same event again: already recorded, nothing changes.
    await applyPostChargeIntent(db as never, intent, "succeeded")
    expect(recordChargeOutcomeEvent).toHaveBeenCalledTimes(1)
  })

  it("never turns a succeeded charge back into a failure, and ignores intents that are not charges", async () => {
    const db = createDb()
    const intent = await processingCharge(db)
    await applyPostChargeIntent(db as never, intent, "succeeded")
    const late = await applyPostChargeIntent(db as never, { ...intent, last_payment_error: { decline_code: "insufficient_funds" } } as never, "failed")

    expect(late?.status).toBe("SUCCEEDED")
    expect(await applyPostChargeIntent(db as never, { id: "pi_other", metadata: {} } as never, "failed")).toBeNull()
  })
})
