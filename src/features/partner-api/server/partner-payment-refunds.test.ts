/** C9: `POST /bookings/:id/refunds` — the partner refunds part or all of a booking's rental payment. */
import { beforeEach, describe, expect, it, vi } from "vitest"

const requirePartnerBooking = vi.fn()
const findPayment = vi.fn()
const refundServicePayment = vi.fn()

class ServicePaymentRefundError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

vi.mock("@/features/partner-api/server/partner-bookings", () => ({ requirePartnerBooking: (...args: unknown[]) => requirePartnerBooking(...args) }))
vi.mock("@/features/transactions/server/service-payment-refunds", () => ({ refundServicePayment: (...args: unknown[]) => refundServicePayment(...args), ServicePaymentRefundError }))
vi.mock("@/lib/db/prisma", () => ({ prisma: { payment: { findUnique: (...args: unknown[]) => findPayment(...args) } } }))
vi.mock("@/lib/integrations/stripe", () => ({ stripeGateway: { name: "gateway" } }))

const { refundPartnerBookingPayment } = await import("./partner-payment-refunds")
const { PartnerApiError } = await import("@/lib/partner-api/errors")

const caller = { vendorProfile: { id: "v1", stripeAccountId: "acct_1" }, apiKey: { id: "k1", prefix: "cz_test_ab" } } as never
const payment = { id: "pay_1", transactionId: "tx1", kind: "SERVICE_PAYMENT", status: "SUCCEEDED", amount: 24000, currency: "EUR", stripeIntentId: "pi_1", refundedAmount: 0 }

beforeEach(() => {
  for (const mock of [requirePartnerBooking, findPayment, refundServicePayment]) mock.mockReset()
  requirePartnerBooking.mockResolvedValue({ id: "tx1" })
  findPayment.mockResolvedValue(payment)
})

describe("refundPartnerBookingPayment", () => {
  it("refunds the rental payment of the vendor's booking and answers with the refund and the payment", async () => {
    refundServicePayment.mockResolvedValue({
      payment: { ...payment, refundedAmount: 12000 },
      refund: { id: "prf_1", amount: 12000, reason: "Cancelled 30 h before pickup", createdAt: new Date("2026-11-20T10:00:00.000Z") },
    })

    const result = await refundPartnerBookingPayment(caller, "tx1", { amount: 12000, reason: "Cancelled 30 h before pickup" })

    expect(requirePartnerBooking).toHaveBeenCalledWith("v1", { id: "tx1" })
    expect(findPayment).toHaveBeenCalledWith({ where: { transactionId_kind: { transactionId: "tx1", kind: "SERVICE_PAYMENT" } } })
    expect(refundServicePayment.mock.calls[0][2]).toEqual({ payment, account: "acct_1", amount: 12000, reason: "Cancelled 30 h before pickup" })
    expect(result).toEqual({
      refund: { id: "prf_1", amount: 12000, reason: "Cancelled 30 h before pickup", createdAt: "2026-11-20T10:00:00.000Z" },
      payment: { amount: 24000, refundedAmount: 12000, currency: "EUR" },
    })
  })

  it("refuses a booking paid nothing online, and a vendor without Stripe", async () => {
    findPayment.mockResolvedValue(null)
    await expect(refundPartnerBookingPayment(caller, "tx1", { reason: "Cancelled" })).rejects.toMatchObject({ code: "payment_not_refundable", status: 409 })

    const noStripe = { vendorProfile: { id: "v1", stripeAccountId: null }, apiKey: { id: "k1", prefix: "cz_test_ab" } } as never
    await expect(refundPartnerBookingPayment(noStripe, "tx1", { reason: "Cancelled" })).rejects.toMatchObject({ code: "stripe_not_connected" })
    expect(refundServicePayment).not.toHaveBeenCalled()
  })

  it("turns refund rule errors into API errors with their details", async () => {
    refundServicePayment.mockRejectedValue(new ServicePaymentRefundError("refund_too_large", "Too much", { refundable: 4000 }))
    const error = await refundPartnerBookingPayment(caller, "tx1", { amount: 9000, reason: "Cancelled" }).catch((e) => e)
    expect(error).toBeInstanceOf(PartnerApiError)
    expect(error).toMatchObject({ code: "refund_too_large", status: 422, details: { refundable: 4000 } })
  })
})
