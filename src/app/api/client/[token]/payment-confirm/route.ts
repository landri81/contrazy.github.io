import { NextResponse } from "next/server"

import {
  syncTransactionFinanceState,
  upsertDepositAuthorizationFromIntent,
  upsertServicePaymentFromIntent,
} from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json({ success: false, message: "Payment intent ID is required" }, { status: 400 })
    }

    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: false, message: "This link is no longer available." }, { status: 410 })
    }

    const link = await prisma.transactionLink.findUnique({
      where: { id: linkContext.link.id },
      include: {
        transaction: {
          include: {
            vendor: true,
            clientProfile: true,
            payments: true,
            depositAuthorization: true,
          },
        },
      },
    })

    if (!link?.transaction?.vendor?.stripeAccountId) {
      return NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 })
    }

    const { transaction } = link
    const stripeAccountId = transaction.vendor.stripeAccountId

    // Retrieve and verify the PaymentIntent from Stripe
    const intent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      getConnectedAccountRequestOptions(stripeAccountId)
    )

    // Validate the intent belongs to this transaction
    if (intent.metadata?.transactionId !== transaction.id) {
      return NextResponse.json({ success: false, message: "Payment intent mismatch" }, { status: 403 })
    }

    const financeStage = intent.metadata?.financeStage
    const isDeposit = financeStage === "deposit_authorization"

    // Map intent status to DB updates
    if (intent.status === "succeeded" && !isDeposit) {
      await upsertServicePaymentFromIntent(prisma, transaction.id, intent)

      await recordTransactionEvent(prisma, {
        transactionId: transaction.id,
        type: "WEBHOOK_PROCESSED",
        title: "Service payment confirmed",
        detail: `PaymentIntent ${intent.id} succeeded.`,
        dedupeKey: `event:payment-confirm:${intent.id}`,
        metadata: { intentId: intent.id, financeStage },
      })
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
      // Payment still processing — client should poll or wait for webhook
      return NextResponse.json({ success: true, status: "processing", nextStep: "payment" })
    } else if (intent.status === "canceled" || intent.status === "requires_payment_method") {
      return NextResponse.json({
        success: false,
        message: intent.last_payment_error?.message ?? "Payment was not successful. Please try again.",
      }, { status: 422 })
    } else {
      // Unknown state — let webhook handle it
      return NextResponse.json({ success: true, status: intent.status, nextStep: "payment" })
    }

    const updated = await syncTransactionFinanceState(prisma, transaction.id)

    if (!updated) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    const nextFinanceStage = (() => {
      const needsService = Boolean(updated.amount && updated.amount > 0)
      const needsDeposit = Boolean(updated.depositAmount && updated.depositAmount > 0)
      const hasService = updated.payments.some(
        (p: { kind: string; status: string }) => p.kind === "SERVICE_PAYMENT" && (p.status === "SUCCEEDED" || p.status === "CAPTURED")
      )
      const hasDeposit = updated.depositAuthorization &&
        ["AUTHORIZED", "CAPTURED", "RELEASED"].includes(updated.depositAuthorization.status)

      if (needsDeposit && !hasDeposit) return "deposit_authorization"
      if (needsService && !hasService) return "service_payment"
      return "complete"
    })()

    const nextStep = nextFinanceStage === "complete" ? "complete" : "payment"

    return NextResponse.json({ success: true, status: "confirmed", nextStep })
  } catch (error) {
    console.error("Payment Confirm Error:", error)
    return NextResponse.json({ success: false, message: "Failed to confirm payment" }, { status: 500 })
  }
}
