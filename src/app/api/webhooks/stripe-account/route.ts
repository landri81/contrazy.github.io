import { NextResponse } from "next/server"
import type Stripe from "stripe"

import {
  syncVendorSubscriptionByStripeId,
  toSubscriptionBillingInterval,
  toSubscriptionPlanKey,
  upsertVendorSubscriptionFromStripeSubscription,
} from "@/features/subscriptions/server/subscription-service"
import { isAlreadyProcessed } from "@/features/webhooks/stripe/utils/idempotency"
import { persistWebhookEvent } from "@/features/webhooks/stripe/utils/log-event"
import { env } from "@/lib/env"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 60

const WEBHOOK_PROVIDER = "stripe_billing"

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const vendorId = session.metadata?.vendorId ?? null
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null
  const planKey = toSubscriptionPlanKey(session.metadata?.planKey) ?? "STARTER"
  const billingInterval = toSubscriptionBillingInterval(session.metadata?.billingInterval) ?? "MONTHLY"

  if (vendorId && stripeCustomerId) {
    await prisma.vendorSubscription.upsert({
      where: { vendorId },
      create: {
        vendorId,
        planKey,
        billingInterval,
        status: "INCOMPLETE",
        stripeCustomerId,
      },
      update: {
        planKey,
        billingInterval,
        stripeCustomerId,
      },
    })
  }

  if (typeof session.subscription === "string") {
    await syncVendorSubscriptionByStripeId(session.subscription, vendorId)
  }

  return { vendorId, transactionId: null as string | null }
}

async function handleInvoiceEvent(invoice: Stripe.Invoice) {
  const stripeSubscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id ?? null

  if (!stripeSubscriptionId) {
    return { vendorId: null, transactionId: null as string | null }
  }

  const subscription = await syncVendorSubscriptionByStripeId(stripeSubscriptionId)
  return { vendorId: subscription.vendorId, transactionId: null as string | null }
}

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get("stripe-signature")

  if (!signature || !env.STRIPE_ACCOUNT_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing Stripe billing signature or secret" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_ACCOUNT_WEBHOOK_SECRET)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Signature verification failed"
    console.error("[stripe-account-webhook] Signature error:", message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (await isAlreadyProcessed(event.id, WEBHOOK_PROVIDER)) {
    return NextResponse.json({ received: true, skipped: true })
  }

  let vendorId: string | null = null
  let transactionId: string | null = null
  let processingError: string | null = null

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const result = await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        vendorId = result.vendorId
        transactionId = result.transactionId
        break
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = await upsertVendorSubscriptionFromStripeSubscription(
          event.data.object as Stripe.Subscription
        )
        vendorId = subscription.vendorId
        break
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const result = await handleInvoiceEvent(event.data.object as Stripe.Invoice)
        vendorId = result.vendorId
        transactionId = result.transactionId
        break
      }
      default:
        break
    }
  } catch (error: unknown) {
    processingError = error instanceof Error ? error.message : "Unknown processing error"
    console.error(
      `[stripe-account-webhook] Handler failed for ${event.type} (${event.id}):`,
      processingError
    )
  }

  await persistWebhookEvent({
    provider: WEBHOOK_PROVIDER,
    eventId: event.id,
    eventType: event.type,
    vendorId,
    transactionId,
    error: processingError,
  })

  if (processingError) {
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
