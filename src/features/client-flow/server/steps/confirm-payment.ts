import { securePaidCardIfRequested } from "@/features/card-security/server/secure-paid-card"
import {
  getNextFinanceStage,
  syncTransactionFinanceState,
  upsertDepositAuthorizationFromIntent,
  upsertDepositChargeFromIntent,
  upsertServicePaymentFromIntent,
} from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { sendVendorFeeReceiptEmail } from "@/lib/integrations/resend"
import { getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"

/**
 * The payment step's confirmation (shared, M10): the PaymentIntent of this booking read on the connected account and
 * recorded (rental payment and the card it saved, deposit hold or charge). Contrazy's page and the partner API call it.
 */

export type PaymentConfirmResult = { status: number; body: { success: boolean; message?: string; status?: string; nextStep?: string } }

export async function confirmClientPayment(linkId: string, paymentIntentId: string): Promise<PaymentConfirmResult> {
  const link = await prisma.transactionLink.findUnique({
    where: { id: linkId },
    include: {
      transaction: {
        include: {
          vendor: true,
          clientProfile: true,
          payments: true,
          depositAuthorization: true,
          cardSecurity: true,
        },
      },
    },
  })

  if (!link?.transaction?.vendor?.stripeAccountId) {
    return { status: 404, body: { success: false, message: "Invalid transaction" } }
  }

  const { transaction } = link
  const stripeAccountId = transaction.vendor.stripeAccountId

  const intent = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    {},
    getConnectedAccountRequestOptions(stripeAccountId)
  )

  if (intent.metadata?.transactionId !== transaction.id) {
    return { status: 403, body: { success: false, message: "Payment intent mismatch" } }
  }

  const financeStage = intent.metadata?.financeStage
  const depositStrategy = intent.metadata?.depositStrategy
  const isDeposit = financeStage === "deposit_authorization"
  const isChargeRefund = depositStrategy === "CHARGE_REFUND"

  if (intent.status === "succeeded" && !isDeposit) {
    await upsertServicePaymentFromIntent(prisma, transaction.id, intent)
    await securePaidCardIfRequested(transaction.id, stripeAccountId, intent)

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "WEBHOOK_PROCESSED",
      title: "Service payment confirmed",
      detail: `PaymentIntent ${intent.id} succeeded.`,
      dedupeKey: `event:payment-confirm:${intent.id}`,
      metadata: { intentId: intent.id, financeStage },
    })
  } else if (intent.status === "succeeded" && isDeposit && isChargeRefund) {
    await upsertDepositChargeFromIntent(prisma, transaction.id, intent)

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "WEBHOOK_PROCESSED",
      title: "Deposit charge confirmed",
      detail: `PaymentIntent ${intent.id} succeeded (charge-and-refund deposit).`,
      dedupeKey: `event:payment-confirm:${intent.id}`,
      metadata: { intentId: intent.id, financeStage, depositStrategy },
    })

    // Send fee receipt to vendor if they accepted a long deposit fee
    if (
      transaction.depositLongTermFeeAcceptedAt &&
      transaction.depositLongTermStripeFeeEstimateAmount &&
      transaction.depositLongTermPlatformFeeAmount &&
      transaction.vendor.businessEmail
    ) {
      sendVendorFeeReceiptEmail(
        transaction.vendor.businessEmail,
        transaction.vendor.businessName ?? "",
        transaction.reference,
        "long_deposit",
        intent.amount,
        transaction.depositLongTermStripeFeeEstimateAmount,
        transaction.depositLongTermPlatformFeeAmount,
        intent.currency.toUpperCase(),
        transaction.vendor.preferredLocale ?? transaction.locale ?? undefined
      ).catch(() => {})
    }
  } else if (intent.status === "requires_capture" && isDeposit) {
    await upsertDepositAuthorizationFromIntent(prisma, transaction.id, intent)

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "WEBHOOK_PROCESSED",
      title: "Deposit authorization confirmed",
      detail: `PaymentIntent ${intent.id} requires capture (deposit held).`,
      dedupeKey: `event:payment-confirm:${intent.id}`,
      metadata: { intentId: intent.id, financeStage },
    })
  } else if (intent.status === "processing") {
    return { status: 200, body: { success: true, status: "processing", nextStep: "payment" } }
  } else if (intent.status === "canceled" || intent.status === "requires_payment_method") {
    return {
      status: 422,
      body: {
        success: false,
        message: intent.last_payment_error?.message ?? "Payment was not successful. Please try again.",
      },
    }
  } else {
    return { status: 200, body: { success: true, status: intent.status, nextStep: "payment" } }
  }

  const updated = await syncTransactionFinanceState(prisma, transaction.id)

  if (!updated) {
    return { status: 404, body: { success: false, message: "Transaction not found" } }
  }

  const nextFinanceStage = getNextFinanceStage(updated)
  const nextStep = nextFinanceStage === "complete" ? "complete" : "payment"

  return { status: 200, body: { success: true, status: "confirmed", nextStep } }
}
