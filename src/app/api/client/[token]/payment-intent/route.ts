import { NextResponse } from "next/server"

import {
  getDepositAutoRefundDays,
  getDepositStrategy,
} from "@/features/subscriptions/server/deposit-strategy"
import { getNextFinanceStage, type FinanceTransaction } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext, markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"
import { getConnectedAccountRequestOptions, getStripePublishableKey, stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: false, message: "This secure link is no longer available." }, { status: 410 })
    }

    await markTransactionLinkOpened(prisma, {
      linkId: linkContext.link.id,
      transactionId: linkContext.link.transaction.id,
    })

    const link = await prisma.transactionLink.findUnique({
      where: { id: linkContext.link.id },
      include: {
        transaction: {
          include: {
            vendor: {
              include: {
                subscription: true,
              },
            },
            clientProfile: true,
            payments: true,
            depositAuthorization: true,
            contractArtifact: true,
          },
        },
      },
    })

    if (!link?.transaction?.vendor?.stripeAccountId) {
      return NextResponse.json({ success: false, message: "Payment configuration unavailable" }, { status: 422 })
    }

    const { transaction } = link
    const financeTransaction: FinanceTransaction = {
      ...transaction,
      link,
      vendor: transaction.vendor,
      clientProfile: transaction.clientProfile,
      payments: transaction.payments,
      depositAuthorization: transaction.depositAuthorization,
      contractArtifact: transaction.contractArtifact,
    }

    const nextStage = getNextFinanceStage(financeTransaction)

    if (nextStage === "complete") {
      return NextResponse.json({
        success: true,
        redirect: withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/complete`),
      })
    }

    const isDeposit = nextStage === "deposit_authorization"
    const amountCents = isDeposit ? transaction.depositAmount! : transaction.amount!
    const stripeAccountId = transaction.vendor.stripeAccountId
    const subscription = transaction.vendor.subscription
    const depositHoldDays = transaction.depositHoldDays ?? 7

    const depositStrategy = isDeposit ? getDepositStrategy(subscription, depositHoldDays) : null
    const isChargeRefund = depositStrategy === "CHARGE_REFUND"

    const depositAutoRefundAt = isDeposit && isChargeRefund
      ? new Date(Date.now() + getDepositAutoRefundDays(subscription, depositHoldDays) * 24 * 60 * 60 * 1000).toISOString()
      : null

    const isFr = transaction.locale === "fr"
    const statementDescriptorSuffix = isDeposit && isChargeRefund
      ? (isFr ? "DEPOT GARANTIE" : "DEPOSIT")
      : undefined

    // For long CHARGE_REFUND deposits the platform fee (0.5%) is collected at charge time.
    // If the vendor later refunds the deposit, the platform fee remains the vendor cost.
    const depositPlatformFee = isDeposit && isChargeRefund
      ? Math.round(amountCents * 0.005)
      : undefined

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: transaction.currency.toLowerCase(),
        capture_method: isDeposit && !isChargeRefund ? "manual" : "automatic",
        payment_method_types: ["card"],
        ...(statementDescriptorSuffix ? { statement_descriptor_suffix: statementDescriptorSuffix } : {}),
        ...(depositPlatformFee ? { application_fee_amount: depositPlatformFee } : {}),
        metadata: {
          transactionId: transaction.id,
          vendorId: transaction.vendorId,
          kind: transaction.kind,
          financeStage: nextStage,
          token,
          ...(isDeposit && depositStrategy ? { depositStrategy } : {}),
          ...(depositAutoRefundAt ? { depositAutoRefundAt } : {}),
          ...(depositPlatformFee ? { depositPlatformFeeAmount: String(depositPlatformFee) } : {}),
          ...(isDeposit ? { depositHoldDays: String(depositHoldDays) } : {}),
        },
        description: `${transaction.title} — ${isDeposit ? "Security Deposit" : "Service Payment"} (${transaction.reference})`,
        receipt_email: transaction.clientProfile?.email ?? undefined,
      },
      getConnectedAccountRequestOptions(stripeAccountId)
    )

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "PAYMENT_SESSION_CREATED",
      title: isDeposit
        ? isChargeRefund
          ? "Deposit charge started"
          : "Deposit authorization started"
        : "Service payment started",
      detail: `PaymentIntent ${intent.id} created for ${isDeposit ? (isChargeRefund ? "deposit charge" : "deposit hold") : "service payment"}.`,
      dedupeKey: `event:payment-intent:${transaction.id}:${nextStage}:${intent.id}`,
      metadata: {
        intentId: intent.id,
        financeStage: nextStage,
        depositStrategy: depositStrategy ?? null,
        depositHoldDays: isDeposit ? depositHoldDays : null,
        depositAutoRefundAt: depositAutoRefundAt ?? null,
      },
    })

    return NextResponse.json({
      success: true,
      clientSecret: intent.client_secret,
      stripeAccountId,
      publishableKey: getStripePublishableKey(),
      financeStage: nextStage,
      amountCents,
      currency: transaction.currency,
      isDeposit,
      title: transaction.title,
      reference: transaction.reference,
      paymentIntentId: intent.id,
      depositStrategy: depositStrategy ?? null,
      depositHoldDays: isDeposit ? depositHoldDays : null,
    })
  } catch (error) {
    console.error("Create Payment Intent Error:", error)
    return NextResponse.json({ success: false, message: "Failed to initialize payment" }, { status: 500 })
  }
}
