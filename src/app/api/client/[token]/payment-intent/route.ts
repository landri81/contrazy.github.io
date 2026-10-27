import { NextResponse } from "next/server"

import { startClientPayment } from "@/features/client-flow/server/steps/start-payment"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: false, message: "This secure link is no longer available." }, { status: 410 })
    }

    const result = await startClientPayment(linkContext, token)

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Create Payment Intent Error:", error)
    return NextResponse.json({ success: false, message: "Failed to initialize payment" }, { status: 500 })
  }
}
