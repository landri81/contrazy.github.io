import type { PartnerApiKey, Payment, PaymentRefund, VendorProfile } from "@prisma/client"
import type { z } from "zod"

import type { partnerBookingRefundSchema } from "@/features/partner-api/schemas/card-charges.schema"
import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { refundServicePayment, ServicePaymentRefundError } from "@/features/transactions/server/service-payment-refunds"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"
import { PartnerApiError } from "@/lib/partner-api/errors"

type Caller = { vendorProfile: VendorProfile; apiKey: Pick<PartnerApiKey, "id" | "prefix"> }

export function presentPaymentRefund(result: { payment: Payment; refund: PaymentRefund }) {
  return {
    refund: { id: result.refund.id, amount: result.refund.amount, reason: result.refund.reason, createdAt: result.refund.createdAt.toISOString() },
    payment: { amount: result.payment.amount, refundedAmount: result.payment.refundedAmount, currency: result.payment.currency },
  }
}

/**
 * Refunds the booking's rental payment fully (no amount) or partly, at Stripe, with a reason (C9: LOCAZ cancellation
 * refunds by its refund windows). 409 `payment_not_refundable` when nothing was paid online, 422 `refund_too_large`.
 */
export async function refundPartnerBookingPayment(caller: Caller, bookingId: string, input: z.infer<typeof partnerBookingRefundSchema>) {
  const booking = await requirePartnerBooking(caller.vendorProfile.id, { id: bookingId })

  if (!caller.vendorProfile.stripeAccountId) {
    throw new PartnerApiError("stripe_not_connected", "Connect a Stripe account first.")
  }

  const payment = await prisma.payment.findUnique({ where: { transactionId_kind: { transactionId: booking.id, kind: "SERVICE_PAYMENT" } } })

  if (!payment) {
    throw new PartnerApiError("payment_not_refundable", "This booking has no rental payment to refund.", { details: { status: "none" } })
  }

  try {
    return presentPaymentRefund(await refundServicePayment(prisma, stripeGateway, { payment, account: caller.vendorProfile.stripeAccountId, amount: input.amount, reason: input.reason }))
  } catch (error) {
    if (error instanceof ServicePaymentRefundError) {
      throw new PartnerApiError(error.code, error.message, { details: error.details })
    }

    throw error
  }
}
