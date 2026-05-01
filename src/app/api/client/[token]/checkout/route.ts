import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { getNextFinanceStage, type FinanceTransaction } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl, getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const link = await prisma.transactionLink.findUnique({
      where: { token },
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
    const financeTransaction = {
      ...transaction,
      link,
      vendor: transaction.vendor,
      clientProfile: transaction.clientProfile,
      payments: transaction.payments,
      depositAuthorization: transaction.depositAuthorization,
    } as FinanceTransaction

    const nextStage = getNextFinanceStage(financeTransaction)

    if (nextStage === "complete") {
      return NextResponse.json({ success: true, url: `/t/${token}/complete` })
    }

    const origin = getAppBaseUrl()
    const lineItemAmount = nextStage === "service_payment" ? transaction.amount! : transaction.depositAmount!
    const lineItemName = nextStage === "service_payment" ? "Service Payment" : "Security Deposit"
    const returnsToPayment =
      nextStage === "service_payment" && Boolean(transaction.depositAmount && transaction.depositAmount > 0)
    const successPath = returnsToPayment
      ? `/t/${token}/payment?stage=service_payment&session_id={CHECKOUT_SESSION_ID}`
      : `/t/${token}/complete?stage=${nextStage}&session_id={CHECKOUT_SESSION_ID}`

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: transaction.currency.toLowerCase(),
            product_data: {
              name: `${transaction.title} - ${lineItemName}`,
              description: `Reference: ${transaction.reference}`,
            },
            unit_amount: lineItemAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}/t/${token}/payment`,
      client_reference_id: transaction.reference,
      customer_email: transaction.clientProfile?.email || undefined,
      metadata: {
        transactionId: transaction.id,
        vendorId: transaction.vendorId,
        kind: transaction.kind,
        financeStage: nextStage,
        token,
      },
    }

    sessionConfig.payment_intent_data =
      nextStage === "deposit_authorization"
        ? {
            capture_method: "manual",
            metadata: {
              transactionId: transaction.id,
              financeStage: nextStage,
            },
          }
        : {
            capture_method: "automatic",
            metadata: {
              transactionId: transaction.id,
              financeStage: nextStage,
            },
          }

    const stripeSession = await stripe.checkout.sessions.create(
      sessionConfig,
      getConnectedAccountRequestOptions(transaction.vendor.stripeAccountId)
    )

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "PAYMENT_SESSION_CREATED",
      title: nextStage === "service_payment" ? "Service payment requested" : "Deposit authorization requested",
      detail: `${lineItemName} session created in Stripe Checkout.`,
      dedupeKey: `event:checkout-session:${transaction.id}:${nextStage}:${stripeSession.id}`,
      metadata: {
        sessionId: stripeSession.id,
        financeStage: nextStage,
      },
    })

    return NextResponse.json({ success: true, url: stripeSession.url })
  } catch (error) {
    console.error("Create Checkout Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create checkout session" }, { status: 500 })
  }
}
