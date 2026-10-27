import { NextResponse } from "next/server"

import { confirmClientPayment } from "@/features/client-flow/server/steps/confirm-payment"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return NextResponse.json({ success: false, message: "Payment intent ID is required" }, { status: 400 })
    }

    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: false, message: "This link is no longer available." }, { status: 410 })
    }

    const result = await confirmClientPayment(linkContext.link.id, paymentIntentId)

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Payment Confirm Error:", error)
    return NextResponse.json({ success: false, message: "Failed to confirm payment" }, { status: 500 })
  }
}
