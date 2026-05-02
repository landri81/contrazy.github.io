import { NextResponse } from "next/server"
import type Stripe from "stripe"

import {
  syncTransactionFinanceState,
  upsertDepositAuthorization,
  upsertServicePayment,
} from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  let event: Stripe.Event

  try {
    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Missing signature or webhook secret")
    }

    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Webhook signature verification failed.", errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  try {
    let vendorId: string | null = null
    let transactionId: string | null = null

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session
        vendorId = session.metadata?.vendorId ?? null
        transactionId = session.metadata?.transactionId ?? null

        if (transactionId) {
          await prisma.$transaction(async (tx) => {
            const financeStage = session.metadata?.financeStage

            if (financeStage === "deposit_authorization") {
              await upsertDepositAuthorization(tx, transactionId!, session)
            } else {
              await upsertServicePayment(tx, transactionId!, session)
            }

            await recordTransactionEvent(tx, {
              transactionId: transactionId!,
              type: "WEBHOOK_PROCESSED",
              title: "Stripe webhook processed",
              detail: `${event.type} handled successfully.`,
              dedupeKey: `event:webhook:${event.id}`,
              metadata: {
                eventId: event.id,
                eventType: event.type,
              },
            })
          })

          await syncTransactionFinanceState(prisma, transactionId)
        }

        break
      }
      default:
        break
    }

    await prisma.webhookEvent.create({
      data: {
        vendorId,
        provider: "stripe",
        eventType: event.type,
        status: "PROCESSED",
        payload: {
          id: event.id,
          type: event.type,
          transactionId,
        },
      },
    })

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("Webhook processing failed.", errorMessage)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
