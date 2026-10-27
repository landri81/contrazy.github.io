import { NextResponse } from "next/server"

import { startClientIdentityVerification } from "@/features/client-flow/server/steps/start-identity"
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
      return NextResponse.json({ success: false, message: "Invalid transaction." }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json(
        { success: false, message: "This secure link is no longer available." },
        { status: 410 }
      )
    }

    const result = await startClientIdentityVerification(linkContext.link.id, token)

    // The page only needs the hosted check's address.
    return NextResponse.json(result.status === 200 ? { success: true, url: result.body.url } : result.body, { status: result.status })
  } catch (error) {
    console.error("Stripe Identity start error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to start identity verification." },
      { status: 500 }
    )
  }
}
