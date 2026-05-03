import { NextResponse } from "next/server"

import { getNextFinanceStage, type FinanceTransaction } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext, markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"

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
            vendor: true,
            clientProfile: true,
            payments: true,
            depositAuthorization: true,
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
    }

    const nextStage = getNextFinanceStage(financeTransaction)

    if (nextStage === "complete") {
      return NextResponse.json({ success: true, redirect: `/t/${token}/complete` })
    }

    const isDeposit = nextStage === "deposit_authorization"
    const amountCents = isDeposit ? transaction.depositAmount! : transaction.amount!
    const stripeAccountId = transaction.vendor.stripeAccountId

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: transaction.currency.toLowerCase(),
        capture_method: isDeposit ? "manual" : "automatic",
        automatic_payment_methods: { enabled: true },
        metadata: {
          transactionId: transaction.id,
          vendorId: transaction.vendorId,
          kind: transaction.kind,
          financeStage: nextStage,
          token,
        },
        description: `${transaction.title} — ${isDeposit ? "Security Deposit" : "Service Payment"} (${transaction.reference})`,
        receipt_email: transaction.clientProfile?.email ?? undefined,
      },
      getConnectedAccountRequestOptions(stripeAccountId)
    )

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "PAYMENT_SESSION_CREATED",
      title: isDeposit ? "Deposit authorization started" : "Service payment started",
      detail: `PaymentIntent ${intent.id} created for ${isDeposit ? "deposit hold" : "service payment"}.`,
      dedupeKey: `event:payment-intent:${transaction.id}:${nextStage}:${intent.id}`,
      metadata: { intentId: intent.id, financeStage: nextStage },
    })

    return NextResponse.json({
      success: true,
      clientSecret: intent.client_secret,
      stripeAccountId,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY,
      financeStage: nextStage,
      amountCents,
      currency: transaction.currency,
      isDeposit,
      title: transaction.title,
      reference: transaction.reference,
      paymentIntentId: intent.id,
    })
  } catch (error) {
    console.error("Create Payment Intent Error:", error)
    return NextResponse.json({ success: false, message: "Failed to initialize payment" }, { status: 500 })
  }
}
