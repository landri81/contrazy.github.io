/**
 * C5b: pickup hold on the saved card (Spec v2.1 §5) and its settlement at return.
 * Spec §18 / §8 touched here: pickup pre-auth, capture ≤ authorized amount, holds
 * skipped for rentals over ~6 days, no off-session retry of a declined card.
 */
import type { CardSecurity, DepositAuthorization, Transaction, VendorProfile } from "@prisma/client"
import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

const upsertDepositAuthorizationFromIntent = vi.fn()
const recordDepositOutcome = vi.fn()
const recordFinanceAuditLog = vi.fn()
vi.mock("@/features/transactions/server/transaction-finance", () => ({
  upsertDepositAuthorizationFromIntent: (...args: unknown[]) => upsertDepositAuthorizationFromIntent(...args),
  recordDepositOutcome: (...args: unknown[]) => recordDepositOutcome(...args),
  recordFinanceAuditLog: (...args: unknown[]) => recordFinanceAuditLog(...args),
  calculateCapturedDepositFeeBreakdown: (amount: number) => ({ stripeFeeAmount: Math.round(amount * 0.015) + 25, platformFeeAmount: Math.round(amount * 0.005), vendorNetAmount: 0 }),
}))
vi.mock("@/lib/integrations/resend", () => ({ sendVendorFeeReceiptEmail: () => Promise.resolve() }))

const { placePickupHold, PickupHoldError, rentalLengthDays } = await import("./pickup-hold")
const { settleDepositHold, DepositSettlementError } = await import("@/features/transactions/server/deposit-settlement")
const { createInMemoryStripeGateway } = await import("@/lib/integrations/stripe-gateway")

const ACCOUNT = "acct_locaz_test"
const DAY = 86_400_000

function booking(overrides: { days?: number; card?: Partial<CardSecurity> | null; hold?: Partial<DepositAuthorization> | null; stepSwitches?: unknown } = {}) {
  const startAt = new Date("2026-11-02T08:00:00Z")
  return {
    id: "tx1",
    vendorId: "v1",
    reference: "TX-1",
    title: "Peugeot 208 rental",
    currency: "EUR",
    locale: "fr",
    externalRef: "LZ-1",
    startAt,
    endAt: new Date(startAt.getTime() + (overrides.days ?? 3) * DAY),
    stepSwitches: overrides.stepSwitches ?? { cardSecurity: true, hold: false },
    vendor: { stripeAccountId: ACCOUNT, businessEmail: "ops@locaz.co", businessName: "LOCAZ", preferredLocale: "fr", businessLogoUrl: null } as VendorProfile,
    clientProfile: null,
    cardSecurity:
      overrides.card === null
        ? null
        : ({ status: "SECURED", stripeCustomerId: "cus_1", paymentMethodId: "pm_card_visa", ...overrides.card } as CardSecurity),
    depositAuthorization: overrides.hold ? ({ id: "da1", amount: 80000, currency: "EUR", depositStrategy: "AUTHORIZATION_HOLD", status: "AUTHORIZED", stripeIntentId: "pi_x", ...overrides.hold } as DepositAuthorization) : null,
  } as unknown as Transaction & { vendor: VendorProfile; cardSecurity: CardSecurity | null; depositAuthorization: DepositAuthorization | null; clientProfile: null }
}

function createDb() {
  const holds: Record<string, unknown>[] = []
  return {
    holds,
    depositAuthorization: {
      async findUniqueOrThrow() {
        return { id: "da1", status: "AUTHORIZED" }
      },
      async update({ data }: { data: Record<string, unknown> }) {
        holds.push(data)
        return data
      },
    },
  }
}

beforeEach(() => {
  upsertDepositAuthorizationFromIntent.mockReset()
  recordDepositOutcome.mockReset()
  recordFinanceAuditLog.mockReset()
})

describe("placing the pickup hold", () => {
  it("authorizes a separate manual-capture PaymentIntent off session on the saved card", async () => {
    const gateway = createInMemoryStripeGateway()
    await placePickupHold(createDb() as never, gateway, { transaction: booking(), amount: 80000, idempotencyKey: "hold-1" })

    const call = gateway.paymentsFake.calls.find((c) => c.method === "createPaymentIntent")
    expect(call).toMatchObject({
      account: ACCOUNT,
      idempotencyKey: expect.stringMatching(/^pickup-hold:tx1:[0-9a-f]{32}$/),
      params: {
        amount: 80000,
        currency: "eur",
        customer: "cus_1",
        payment_method: "pm_card_visa",
        capture_method: "manual",
        off_session: true,
        confirm: true,
        metadata: { transactionId: "tx1", financeStage: "deposit_authorization", pickupHold: "true" },
      },
    })
    const intent = upsertDepositAuthorizationFromIntent.mock.calls[0][2] as Stripe.PaymentIntent
    expect(intent).toMatchObject({ status: "requires_capture", amount_capturable: 80000 })
  })

  it("sends the same Stripe idempotency key for the same partner key (one hold on a retried request)", async () => {
    const gateway = createInMemoryStripeGateway()
    await placePickupHold(createDb() as never, gateway, { transaction: booking(), amount: 80000, idempotencyKey: "hold-1" })
    await placePickupHold(createDb() as never, gateway, { transaction: booking(), amount: 80000, idempotencyKey: "hold-1" })

    const keys = gateway.paymentsFake.calls.filter((c) => c.method === "createPaymentIntent").map((c) => c.idempotencyKey)
    expect(new Set(keys).size).toBe(1)
    expect((upsertDepositAuthorizationFromIntent.mock.calls[0][2] as Stripe.PaymentIntent).id).toBe(
      (upsertDepositAuthorizationFromIntent.mock.calls[1][2] as Stripe.PaymentIntent).id
    )
  })

  it.each([
    ["no card security", { card: null }, "card_not_secured"],
    ["a card not secured yet", { card: { status: "PENDING" } }, "card_not_secured"],
    ["an active hold", { hold: { status: "AUTHORIZED" } }, "hold_exists"],
    ["a deposit step in the customer flow", { stepSwitches: { cardSecurity: true, hold: true } }, "hold_exists"],
  ] as const)("refuses a booking with %s", async (_label, overrides, code) => {
    await expect(
      placePickupHold(createDb() as never, createInMemoryStripeGateway(), { transaction: booking(overrides as never), amount: 80000, idempotencyKey: "k" })
    ).rejects.toMatchObject({ code })
  })

  it("allows a new hold once the previous one was released", async () => {
    const gateway = createInMemoryStripeGateway()
    await placePickupHold(createDb() as never, gateway, { transaction: booking({ hold: { status: "RELEASED" } }), amount: 50000, idempotencyKey: "k2" })
    expect(upsertDepositAuthorizationFromIntent).toHaveBeenCalledTimes(1)
  })

  it("refuses a hold on a rental over 6 days unless forced (it would expire before return)", async () => {
    const error = await placePickupHold(createDb() as never, createInMemoryStripeGateway(), { transaction: booking({ days: 7 }), amount: 80000, idempotencyKey: "k" }).catch((e) => e)

    expect(error).toBeInstanceOf(PickupHoldError)
    expect(error).toMatchObject({ code: "hold_not_recommended", details: { rentalDays: 7, maxRentalDays: 6 } })

    await placePickupHold(createDb() as never, createInMemoryStripeGateway(), { transaction: booking({ days: 7 }), amount: 80000, force: true, idempotencyKey: "k" })
    await placePickupHold(createDb() as never, createInMemoryStripeGateway(), { transaction: booking({ days: 6 }), amount: 80000, idempotencyKey: "k" })
    expect(upsertDepositAuthorizationFromIntent).toHaveBeenCalledTimes(2)
    expect(rentalLengthDays({ startAt: null, endAt: null })).toBeNull()
  })

  it.each([
    ["pm_card_chargeCustomerFail", "generic_decline", false],
    ["pm_card_authenticationRequired", "authentication_required", true],
  ] as const)("reports a declined card (%s) as hold_failed without retrying", async (pm, declineCode, requiresAction) => {
    const gateway = createInMemoryStripeGateway()
    const error = await placePickupHold(createDb() as never, gateway, { transaction: booking({ card: { paymentMethodId: pm } }), amount: 80000, idempotencyKey: "k" }).catch((e) => e)

    expect(error).toMatchObject({ code: "hold_failed", details: { declineCode, requiresAction } })
    expect(gateway.paymentsFake.calls.filter((c) => c.method === "createPaymentIntent")).toHaveLength(1)
    expect(upsertDepositAuthorizationFromIntent).not.toHaveBeenCalled()
  })
})

async function authorizedHold(gateway: ReturnType<typeof createInMemoryStripeGateway>, amount = 80000) {
  const intent = await gateway.payments.createPaymentIntent(
    { amount, currency: "eur", customer: "cus_1", payment_method: "pm_card_visa", capture_method: "manual", off_session: true, confirm: true },
    { account: ACCOUNT }
  )
  return booking({ hold: { amount, stripeIntentId: intent.id } })
}

describe("settling the hold at return", () => {
  const actor = { id: null, type: "SYSTEM" as const, via: "partner_api:cz_test_E2eKey00" }

  it("captures part of the hold for the damage found, with the platform fee, once", async () => {
    const gateway = createInMemoryStripeGateway()
    const transaction = await authorizedHold(gateway)
    const db = createDb()

    const result = await settleDepositHold(db as never, gateway, { transaction, action: "capture", captureAmount: 25000, actor })
    await expect(settleDepositHold(db as never, gateway, { transaction, action: "capture", captureAmount: 25000, actor })).resolves.toBeDefined()

    const captures = gateway.paymentsFake.calls.filter((c) => c.method === "capturePaymentIntent")
    expect(captures[0]).toMatchObject({ idempotencyKey: "deposit-capture:da1", params: { amount_to_capture: 25000, application_fee_amount: 125 } })
    // The second call carries the same key: Stripe returns the first capture, nothing is charged twice.
    expect(captures[1].idempotencyKey).toBe(captures[0].idempotencyKey)
    expect((await gateway.payments.retrievePaymentIntent(transaction.depositAuthorization!.stripeIntentId!, { account: ACCOUNT })).amount_received).toBe(25000)
    expect(result.actualAmount).toBe(25000)
    expect(db.holds[0]).toMatchObject({ status: "CAPTURED", depositCapturedAmount: 25000 })
    expect(recordDepositOutcome).toHaveBeenCalledWith(db, expect.objectContaining({ action: "capture", actualAmount: 25000, amount: 80000, reason: "manual_capture" }))
    expect(recordFinanceAuditLog).toHaveBeenCalledWith(db, expect.objectContaining({ actorType: "SYSTEM", metadata: expect.objectContaining({ captureType: "partial", via: actor.via }) }))
  })

  it("refuses to capture more than the authorized amount", async () => {
    const gateway = createInMemoryStripeGateway()
    const transaction = await authorizedHold(gateway, 30000)
    const error = await settleDepositHold(createDb() as never, gateway, { transaction, action: "capture", captureAmount: 30001, actor }).catch((e) => e)

    expect(error).toBeInstanceOf(DepositSettlementError)
    expect(error.code).toBe("invalid_amount")
    expect(gateway.paymentsFake.calls.some((c) => c.method === "capturePaymentIntent")).toBe(false)
  })

  it("releases the hold by cancelling it at Stripe", async () => {
    const gateway = createInMemoryStripeGateway()
    const transaction = await authorizedHold(gateway)
    const db = createDb()

    await settleDepositHold(db as never, gateway, { transaction, action: "release", actor })

    expect((await gateway.payments.retrievePaymentIntent(transaction.depositAuthorization!.stripeIntentId!, { account: ACCOUNT })).status).toBe("canceled")
    expect(db.holds[0]).toMatchObject({ status: "RELEASED" })
    expect(recordDepositOutcome).toHaveBeenCalledWith(db, expect.objectContaining({ action: "release", reason: "manual_release" }))
  })

  it("refuses a hold that is no longer active", async () => {
    const gateway = createInMemoryStripeGateway()
    await expect(
      settleDepositHold(createDb() as never, gateway, { transaction: booking({ hold: { status: "RELEASED" } }), action: "release", actor })
    ).rejects.toMatchObject({ code: "not_active" })
    await expect(settleDepositHold(createDb() as never, gateway, { transaction: booking(), action: "capture", actor })).rejects.toMatchObject({ code: "not_found" })
  })
})
