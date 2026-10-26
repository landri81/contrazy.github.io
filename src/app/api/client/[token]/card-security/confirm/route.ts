import { NextResponse } from "next/server"
import { z } from "zod"

import { CardSecurityError, markCardSecured, setupFailureMessage } from "@/features/card-security/server/card-security"
import { loadClientCardSecurityContext } from "@/features/card-security/server/client-card-security"
import { getNextFinanceStage, syncTransactionFinanceState } from "@/features/transactions/server/transaction-finance"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"

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

    const { transaction, stripeAccountId } = context

    if (transaction.cardSecurity?.setupIntentId !== parsed.data.setupIntentId) {
      return NextResponse.json({ success: false, message: "Setup intent mismatch" }, { status: 403 })
    }

    const intent = await stripeGateway.payments.retrieveSetupIntent(parsed.data.setupIntentId, { account: stripeAccountId })

    if (intent.status === "processing") {
      return NextResponse.json({ success: true, status: "processing", nextStep: "payment" })
    }

    if (intent.status !== "succeeded") {
      return NextResponse.json(
        { success: false, message: setupFailureMessage(intent) ?? "Your card could not be saved. Please try another card." },
        { status: 422 }
      )
    }

    await markCardSecured(prisma, stripeGateway, { transactionId: transaction.id, stripeAccountId, intent })
    const updated = await syncTransactionFinanceState(prisma, transaction.id)
    const nextStage = updated ? getNextFinanceStage(updated) : "complete"

    return NextResponse.json({ success: true, status: "confirmed", nextStep: nextStage === "complete" ? "complete" : "payment" })
  } catch (error) {
    if (error instanceof CardSecurityError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: 409 })
    }

    console.error("Card setup confirm error", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Could not confirm your card. Please try again." }, { status: 500 })
  }
}
