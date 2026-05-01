import { NextResponse } from "next/server"
import { stripe } from "@/lib/integrations/stripe"
import { prisma } from "@/lib/db/prisma"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  let event

  try {
    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Missing signature or webhook secret")
    }
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error("Webhook signature verification failed.", errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  try {
    // We mainly care about connect account events and checkout sessions
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session

        const transactionId = session.metadata?.transactionId
        
        if (transactionId) {
          // This is a backup to the inline update in complete/page.tsx
          // Ensures we mark it paid even if they close browser
          const tx = await prisma.transaction.findUnique({ where: { id: transactionId }})
          if (tx && tx.status !== "COMPLETED") {
             // In a fully robust system we'd process payment records here too.
             // For the MVP, we rely on the redirect for immediate UX, and use this as backup
             await prisma.transaction.update({
               where: { id: transactionId },
               data: { status: "COMPLETED" }
             })
          }
        }
        break
      }
      // Add handlers for deposit release/capture later if needed
    }

    // Log the event
    await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        eventType: event.type,
        status: "PROCESSED"
      }
    })

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error("Webhook processing failed.", errorMessage)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
