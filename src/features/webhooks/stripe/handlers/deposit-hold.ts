import type Stripe from "stripe"

import { recordDepositOutcome } from "@/features/transactions/server/transaction-finance"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"
import { prisma } from "@/lib/db/prisma"

/**
 * `payment_intent.canceled` for a deposit hold that is still AUTHORIZED here:
 * Stripe cancelled it itself (an uncaptured card hold lapses after about 7
 * days) or someone cancelled it in the Stripe dashboard. The booking then
 * shows the hold as released (`booking.hold_released`). Holds we cancel
 * ourselves are already RELEASED, so they are skipped.
 */
export async function handlePaymentIntentCanceled(intent: Stripe.PaymentIntent, eventId: string): Promise<WebhookHandlerResult> {
  const transactionId = intent.metadata?.transactionId ?? null
  const vendorId = intent.metadata?.vendorId ?? null

  if (!transactionId || intent.metadata?.financeStage !== "deposit_authorization") {
    return { vendorId, transactionId }
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { depositAuthorization: true, vendor: true, clientProfile: true },
  })
  const hold = transaction?.depositAuthorization

  if (!transaction || !hold || hold.stripeIntentId !== intent.id || hold.status !== "AUTHORIZED") {
    return { vendorId, transactionId }
  }

  const releasedAt = new Date()
  const expired = intent.cancellation_reason === "automatic"
  const updated = await prisma.depositAuthorization.updateMany({
    where: { id: hold.id, status: "AUTHORIZED" },
    data: { status: "RELEASED", releasedAt },
  })

  // A concurrent manual release got there first: it records the outcome itself.
  if (updated.count === 1) {
    await recordDepositOutcome(prisma, {
      transactionId,
      amount: hold.amount,
      currency: hold.currency,
      stripeIntentId: intent.id,
      action: "release",
      reason: expired ? "hold_expired" : "manual_release",
      occurredAt: releasedAt,
      vendorBusinessEmail: transaction.vendor.businessEmail,
      vendorBusinessName: transaction.vendor.businessName,
      clientFullName: transaction.clientProfile?.fullName,
      clientEmail: transaction.clientProfile?.email,
      locale: transaction.locale,
      vendorLocale: transaction.vendor.preferredLocale,
      vendorLogoUrl: transaction.vendor.businessLogoUrl,
    })
  }

  console.info("Deposit hold cancelled at Stripe", { eventId, transactionId, reason: intent.cancellation_reason ?? null })
  return { vendorId: transaction.vendorId, transactionId }
}
