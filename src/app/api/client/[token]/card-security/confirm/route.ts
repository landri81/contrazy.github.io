import { NextResponse } from "next/server"
import { z } from "zod"

import { loadClientCardSecurityContext } from "@/features/card-security/server/client-card-security"
import { confirmClientCardSetup } from "@/features/client-flow/server/steps/card-setup"

export const runtime = "nodejs"
export const maxDuration = 30

const confirmSchema = z.object({ setupIntentId: z.string().trim().min(1).max(255) })

/**
 * After `stripe.confirmSetup` in the browser: reads the SetupIntent at Stripe
 * (never trusts the browser) and marks the card secured when it succeeded.
 * The `setup_intent.succeeded` webhook does the same as a safety net.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const parsed = confirmSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Setup intent ID is required" }, { status: 400 })
    }

    const context = await loadClientCardSecurityContext(token)

    if ("error" in context) {
      return context.error
    }

    const result = await confirmClientCardSetup(context, parsed.data.setupIntentId)

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Card setup confirm error", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Could not confirm your card. Please try again." }, { status: 500 })
  }
}
