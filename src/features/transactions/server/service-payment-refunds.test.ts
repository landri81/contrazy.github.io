/**
 * C9: refunds of a booking's rental payment (LOCAZ cancellation refunds by its refund windows), always at Stripe.
 */
import type { Payment, PaymentRefund } from "@prisma/client"
import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

const recordTransactionEvent = vi.fn()
vi.mock("@/features/transactions/server/transaction-events", () => ({ recordTransactionEvent: (...args: unknown[]) => recordTransactionEvent(...args) }))
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://app.contrazy.test" } }))

const { refundServicePayment, reconcileServicePaymentRefunds, ServicePaymentRefundError, isRefundableServicePayment } = await import("./service-payment-refunds")
const { createInMemoryStripeGateway } = await import("@/lib/integrations/stripe-gateway")

const ACCOUNT = "acct_locaz_test"

function createDb(payment: Payment) {
  const refunds: PaymentRefund[] = []
  let seq = 0
  const db = {
    payment: {
      async findUnique({ where }: { where: { id: string } }) {
        return where.id === payment.id ? { ...payment } : null
      },
      async findUniqueOrThrow() {
        return { ...payment }
      },
      async findFirst({ where }: { where: { stripeIntentId: string; kind: string } }) {
        return where.stripeIntentId === payment.stripeIntentId && where.kind === payment.kind ? { ...payment } : null
      },
      async update({ data }: { data: Partial<Payment> }) {
        return { ...Object.assign(payment, data) }
      },
    },
    paymentRefund: {
      async findUnique({ where }: { where: { stripeRefundId: string } }) {
        return refunds.find((r) => r.stripeRefundId === where.stripeRefundId) ?? null
      },
      async create({ data }: { data: Omit<PaymentRefund, "id" | "createdAt"> }) {
        const row = { ...data, id: `prf_${++seq}`, createdAt: new Date() } as PaymentRefund
        refunds.push(row)
        return row
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>) {
      return fn(db)
    },
  }
  return { db, payment, refunds }
}

async function paidRental(gateway: ReturnType<typeof createInMemoryStripeGateway>, amount = 24000) {
  const intent = await gateway.payments.createPaymentIntent(
    { amount, currency: "eur", customer: "cus_1", payment_method: "pm_card_visa", off_session: true, confirm: true },
    { account: ACCOUNT }
  )
  return { id: "pay_rental", transactionId: "tx1", kind: "SERVICE_PAYMENT", status: "SUCCEEDED", amount, currency: "EUR", stripeIntentId: intent.id, refundedAmount: 0 } as Payment
}

beforeEach(() => recordTransactionEvent.mockReset())

describe("refunding the rental payment (C9)", () => {
  it("refunds part of the rental at Stripe with the reason, then the rest, with one event per refund", async () => {
    const gateway = createInMemoryStripeGateway()
    const { db, payment, refunds } = createDb(await paidRental(gateway))

    const partial = await refundServicePayment(db as never, gateway, { payment: { ...payment }, account: ACCOUNT, amount: 12000, reason: "Cancelled 30 h before pickup (50 %)" })
    expect(partial.payment.refundedAmount).toBe(12000)
    expect(partial.refund).toMatchObject({ amount: 12000, reason: "Cancelled 30 h before pickup (50 %)", stripeRefundId: expect.stringMatching(/^re_fake_/) })
    expect(gateway.paymentsFake.calls.find((c) => c.method === "createRefund")).toMatchObject({
      account: ACCOUNT,
      idempotencyKey: "service_refund_pay_rental_0_12000",
      params: { amount: 12000, metadata: { paymentId: "pay_rental", reason: "Cancelled 30 h before pickup (50 %)" } },
    })
    expect(recordTransactionEvent.mock.calls[0][1]).toMatchObject({
      transactionId: "tx1",
      type: "SERVICE_PAYMENT_REFUNDED",
      metadata: { refundId: "prf_1", amount: 12000, currency: "EUR", reason: "Cancelled 30 h before pickup (50 %)" },
      dedupeKey: "service_refund:prf_1",
    })

    const rest = await refundServicePayment(db as never, gateway, { payment: { ...payment }, account: ACCOUNT, reason: "Goodwill" })
    expect(rest.refund.amount).toBe(12000)
    expect(payment.refundedAmount).toBe(24000)
    expect(refunds).toHaveLength(2)
  })

  it("never refunds more than what is left, nor a payment that did not go through", async () => {
    const gateway = createInMemoryStripeGateway()
    const { db, payment } = createDb(await paidRental(gateway))
    await refundServicePayment(db as never, gateway, { payment: { ...payment }, account: ACCOUNT, amount: 20000, reason: "Cancelled early" })

    const tooMuch = await refundServicePayment(db as never, gateway, { payment: { ...payment }, account: ACCOUNT, amount: 4001, reason: "Again" }).catch((e) => e)
    expect(tooMuch).toBeInstanceOf(ServicePaymentRefundError)
    expect(tooMuch).toMatchObject({ code: "refund_too_large", details: { refundable: 4000 } })

    const pending = { ...payment, status: "PENDING" } as Payment
    await expect(refundServicePayment(db as never, gateway, { payment: pending, account: ACCOUNT, reason: "x" })).rejects.toMatchObject({ code: "payment_not_refundable", details: { status: "pending" } })
    expect(isRefundableServicePayment({ kind: "DEPOSIT_CAPTURE", status: "SUCCEEDED", stripeIntentId: "pi_1" })).toBe(false)
    expect(gateway.paymentsFake.calls.filter((c) => c.method === "createRefund")).toHaveLength(1)
  })

  it("a re-sent refund request refunds once (same Stripe key, one row)", async () => {
    const gateway = createInMemoryStripeGateway()
    const { db, payment, refunds } = createDb(await paidRental(gateway))
    const snapshot = { ...payment }

    await refundServicePayment(db as never, gateway, { payment: snapshot, account: ACCOUNT, amount: 5000, reason: "Goodwill" })
    await refundServicePayment(db as never, gateway, { payment: snapshot, account: ACCOUNT, amount: 5000, reason: "Goodwill" })

    expect(refunds).toHaveLength(1)
    expect(payment.refundedAmount).toBe(5000)
  })
})

describe("charge.refunded for a rental payment", () => {
  it("records a refund made in the Stripe dashboard once, and ignores other payments", async () => {
    const gateway = createInMemoryStripeGateway()
    const { db, payment, refunds } = createDb(await paidRental(gateway))
    const stripeCharge = { payment_intent: payment.stripeIntentId, refunds: { data: [{ id: "re_dashboard_1", amount: 3000, status: "succeeded", metadata: {} }] } } as unknown as Stripe.Charge

    await reconcileServicePaymentRefunds(db as never, stripeCharge)
    await reconcileServicePaymentRefunds(db as never, stripeCharge)

    expect(refunds).toEqual([expect.objectContaining({ stripeRefundId: "re_dashboard_1", amount: 3000, reason: "Refunded in the Stripe dashboard" })])
    expect(payment.refundedAmount).toBe(3000)
    expect(recordTransactionEvent).toHaveBeenCalledTimes(1)
    expect(await reconcileServicePaymentRefunds(db as never, { payment_intent: "pi_elsewhere", refunds: { data: [] } } as never)).toBeNull()
  })
})
