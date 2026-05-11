import { NextResponse } from "next/server"

import { dispatchStripeEvent } from "@/features/webhooks/stripe/dispatcher"
import { isAlreadyProcessed } from "@/features/webhooks/stripe/utils/idempotency"
import { persistWebhookEvent } from "@/features/webhooks/stripe/utils/log-event"
import { stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  // ── 1. Verify Stripe signature ─────────────────────────────────────────────
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing Stripe signature or secret" }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signature verification failed"
    console.error("[webhook] Signature error:", message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // ── 2. Idempotency guard ───────────────────────────────────────────────────
  if (await isAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, skipped: true })
  }

  // ── 3. Dispatch to handler ─────────────────────────────────────────────────
  let vendorId: string | null = null
  let transactionId: string | null = null
  let processingError: string | null = null

  try {
    const result = await dispatchStripeEvent(event)
    vendorId = result.vendorId
    transactionId = result.transactionId
  } catch (err: unknown) {
    processingError = err instanceof Error ? err.message : "Unknown processing error"
    console.error(`[webhook] Handler failed for ${event.type} (${event.id}):`, processingError)
  }

  // ── 4. Persist audit record (always, regardless of outcome) ───────────────
  await persistWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    vendorId,
    transactionId,
    error: processingError,
  })

  // Return 500 so Stripe retries on handler failure; 200 on success
  if (processingError) {
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
