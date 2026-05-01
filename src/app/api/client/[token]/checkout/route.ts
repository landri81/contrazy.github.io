import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

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
            clientProfile: true
          }
        }
      }
    })

    if (!link || !link.transaction || !link.transaction.vendor.stripeAccountId) {
      return NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 })
    }

    const { transaction } = link

    // Calculate amounts
    const hasServicePayment = transaction.amount && transaction.amount > 0
    const hasDeposit = transaction.depositAmount && transaction.depositAmount > 0

    if (!hasServicePayment && !hasDeposit) {
      // Free transaction, mark as completed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "COMPLETED" }
      })
      return NextResponse.json({ success: true, url: `/t/${token}/complete` })
    }

    // Prepare line items
    const lineItems = []

    if (hasServicePayment) {
      lineItems.push({
        price_data: {
          currency: transaction.currency.toLowerCase(),
          product_data: {
            name: `${transaction.title} - Service Payment`,
            description: `Reference: ${transaction.reference}`,
          },
          unit_amount: transaction.amount!,
        },
        quantity: 1,
      })
    }

    if (hasDeposit) {
      lineItems.push({
        price_data: {
          currency: transaction.currency.toLowerCase(),
          product_data: {
            name: `${transaction.title} - Security Deposit`,
            description: `Reference: ${transaction.reference}`,
          },
          unit_amount: transaction.depositAmount!,
        },
        quantity: 1,
      })
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // Set up Stripe Checkout Session
    // For deposits, we want to authorize only. Stripe Checkout doesn't easily support mixed auth-only and capture in a single session.
    // However, if we need BOTH, we typically capture the full amount or split the flows.
    // For this MVP, if there is a deposit, we'll configure the checkout session to `payment_intent_data.capture_method = "manual"` 
    // This authorizes the whole amount, allowing the vendor to capture only the service part and hold the deposit.

    const sessionConfig: import("stripe").Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/t/${token}/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/t/${token}/payment`,
      client_reference_id: transaction.reference,
      customer_email: transaction.clientProfile?.email || undefined,
      metadata: {
        transactionId: transaction.id,
        kind: transaction.kind
      }
    }

    if (hasDeposit) {
      sessionConfig.payment_intent_data = {
        capture_method: 'manual', // Authorize only
        metadata: {
          transactionId: transaction.id,
          depositAmount: transaction.depositAmount
        }
      }
    } else {
      sessionConfig.payment_intent_data = {
        capture_method: 'automatic', // Capture immediately
        metadata: {
          transactionId: transaction.id
        }
      }
    }

    // Create checkout session on behalf of the connected account
    const stripeSession = await stripe.checkout.sessions.create(sessionConfig, {
      stripeAccount: transaction.vendor.stripeAccountId || undefined
    })

    return NextResponse.json({ success: true, url: stripeSession.url })
  } catch (error) {
    console.error("Create Checkout Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create checkout session" }, { status: 500 })
  }
}
