import { NextResponse } from "next/server"

import { stripe } from "@/lib/integrations/stripe"

export async function GET() {
  try {
    const balance = await stripe.balance.retrieve()

    return NextResponse.json({
      ok: true,
      service: "stripe",
      available: balance.available,
      pending: balance.pending,
      livemode: balance.livemode,
    })
  } catch (error) {
    console.error("Stripe ping failed", error)
    return NextResponse.json(
      {
        ok: false,
        service: "stripe",
        message: "Stripe ping failed",
      },
      { status: 500 }
    )
  }
}
