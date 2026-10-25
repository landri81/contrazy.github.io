/**
 * C6c: refunds of post-rental charges (Spec v2.1 §11).
 * Spec §18 #15: partial refund of an FPS → correct amount at Stripe, status and refunded amount updated.
 */
import type { PostCharge, PostChargeRefund } from "@prisma/client"
import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

const recordRefundSucceededEvent = vi.fn()
vi.mock("@/features/partner-webhooks/server/charge-events", () => ({
  recordChargeOutcomeEvent: vi.fn(),
  recordRefundSucceededEvent: (...args: unknown[]) => recordRefundSucceededEvent(...args),
}))
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://app.contrazy.test" } }))

const { refundPostCharge, reconcilePostChargeRefunds, PostChargeRefundError } = await import("./post-charges")
const { createInMemoryStripeGateway } = await import("@/lib/integrations/stripe-gateway")

const ACCOUNT = "acct_locaz_test"

function createDb(charge: PostCharge) {
  const refunds: PostChargeRefund[] = []
  let seq = 0
  const db = {
    charge,
    refunds,
    postCharge: {
      async findUnique({ where }: { where: { id?: string; paymentIntentId?: string } }) {
        return where.id === charge.id || where.paymentIntentId === charge.paymentIntentId ? { ...charge } : null
      },
      async findUniqueOrThrow() {
        return { ...charge }
      },
      async update({ data }: { data: Partial<PostCharge> }) {
        return { ...Object.assign(charge, data) }
      },
    },
    postChargeRefund: {
      async findUnique({ where }: { where: { stripeRefundId: string } }) {
        return refunds.find((r) => r.stripeRefundId === where.stripeRefundId) ?? null
      },
      async create({ data }: { data: Omit<PostChargeRefund, "id" | "createdAt"> }) {
        const row = { ...data, id: `pcr_${++seq}`, createdAt: new Date() } as PostChargeRefund
        refunds.push(row)
        return row
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
      return fn(db)
    },
  }
  return db
}

async function paidCharge(gateway: ReturnType<typeof createInMemoryStripeGateway>, amount = 3500) {
  const intent = await gateway.payments.createPaymentIntent(
    { amount, currency: "eur", customer: "cus_1", payment_method: "pm_card_visa", off_session: true, confirm: true },
    { account: ACCOUNT }
  )
  return {
    id: "pc_fps",
    transactionId: "tx1",
    vendorId: "v1",
    type: "FPS",
    amount,
    currency: "EUR",
    status: "SUCCEEDED",
    paymentIntentId: intent.id,
    refundedAmount: 0,
  } as PostCharge
}

beforeEach(() => recordRefundSucceededEvent.mockReset())

describe("refunding a post-rental charge (Spec §18 #15)", () => {
  it("refunds part of an FPS at Stripe, then the rest", async () => {
    const gateway = createInMemoryStripeGateway()
    const db = createDb(await paidCharge(gateway))

    const partial = await refundPostCharge(db as never, gateway, { charge: db.charge, account: ACCOUNT, amount: 1500, reason: "FPS reduced on appeal" })
    expect(partial.charge).toMatchObject({ status: "PARTIALLY_REFUNDED", refundedAmount: 1500 })
    expect(partial.refund).toMatchObject({ amount: 1500, reason: "FPS reduced on appeal", stripeRefundId: expect.stringMatching(/^re_fake_/) })
    expect(gateway.paymentsFake.calls.find((c) => c.method === "createRefund")).toMatchObject({
      account: ACCOUNT,
      idempotencyKey: "postcharge_refund_pc_fps_0_1500",
      params: { amount: 1500, metadata: { postChargeId: "pc_fps", reason: "FPS reduced on appeal" } },
    })
    expect(recordRefundSucceededEvent.mock.calls[0][1]).toMatchObject({ transactionId: "tx1", refund: { chargeId: "pc_fps", amount: 1500, currency: "EUR", reason: "FPS reduced on appeal" } })

    const rest = await refundPostCharge(db as never, gateway, { charge: db.charge, account: ACCOUNT, reason: "FPS cancelled" })
    expect(rest.charge).toMatchObject({ status: "REFUNDED", refundedAmount: 3500 })
    expect(rest.refund.amount).toBe(2000)
    expect(db.refunds).toHaveLength(2)
  })

  it("never refunds more than what is left, nor a charge that did not go through", async () => {
    const gateway = createInMemoryStripeGateway()
    const db = createDb(await paidCharge(gateway))
    await refundPostCharge(db as never, gateway, { charge: db.charge, account: ACCOUNT, amount: 3000, reason: "Goodwill" })

    const tooMuch = await refundPostCharge(db as never, gateway, { charge: db.charge, account: ACCOUNT, amount: 501, reason: "Again" }).catch((e) => e)
    expect(tooMuch).toBeInstanceOf(PostChargeRefundError)
    expect(tooMuch).toMatchObject({ code: "refund_too_large", details: { refundable: 500 } })

    const failed = { ...db.charge, status: "FAILED" } as PostCharge
    await expect(refundPostCharge(db as never, gateway, { charge: failed, account: ACCOUNT, reason: "x" })).rejects.toMatchObject({ code: "charge_not_refundable" })
    expect(gateway.paymentsFake.calls.filter((c) => c.method === "createRefund")).toHaveLength(1)
  })

  it("a re-sent refund request refunds once (same Stripe key, one row)", async () => {
    const gateway = createInMemoryStripeGateway()
    const charge = await paidCharge(gateway)
    const db = createDb(charge)
    const snapshot = { ...charge }

    await refundPostCharge(db as never, gateway, { charge: snapshot, account: ACCOUNT, amount: 1000, reason: "Goodwill" })
    await refundPostCharge(db as never, gateway, { charge: snapshot, account: ACCOUNT, amount: 1000, reason: "Goodwill" })

    expect(db.refunds).toHaveLength(1)
    expect(db.charge.refundedAmount).toBe(1000)
  })
})

describe("charge.refunded webhook", () => {
  it("records a refund made in the Stripe dashboard once, with its own event", async () => {
    const gateway = createInMemoryStripeGateway()
    const db = createDb(await paidCharge(gateway))
    const stripeCharge = {
      payment_intent: db.charge.paymentIntentId,
      refunds: { data: [{ id: "re_dashboard_1", amount: 1200, status: "succeeded", metadata: {} }] },
    } as unknown as Stripe.Charge

    await reconcilePostChargeRefunds(db as never, stripeCharge)
    await reconcilePostChargeRefunds(db as never, stripeCharge)

    expect(db.refunds).toEqual([expect.objectContaining({ stripeRefundId: "re_dashboard_1", amount: 1200, reason: "Refunded in the Stripe dashboard" })])
    expect(db.charge).toMatchObject({ status: "PARTIALLY_REFUNDED", refundedAmount: 1200 })
    expect(recordRefundSucceededEvent).toHaveBeenCalledTimes(1)
  })

  it("skips refunds already recorded by the API and charges that are not ours", async () => {
    const gateway = createInMemoryStripeGateway()
    const db = createDb(await paidCharge(gateway))
    const { refund } = await refundPostCharge(db as never, gateway, { charge: db.charge, account: ACCOUNT, amount: 500, reason: "Toll error" })
    recordRefundSucceededEvent.mockReset()

    await reconcilePostChargeRefunds(db as never, { payment_intent: db.charge.paymentIntentId, refunds: { data: [{ id: refund.stripeRefundId, amount: 500, status: "succeeded", metadata: {} }] } } as never)
    expect(db.refunds).toHaveLength(1)
    expect(db.charge.refundedAmount).toBe(500)
    expect(recordRefundSucceededEvent).not.toHaveBeenCalled()
    expect(await reconcilePostChargeRefunds(db as never, { payment_intent: "pi_elsewhere", refunds: { data: [] } } as never)).toBeNull()
  })
})
