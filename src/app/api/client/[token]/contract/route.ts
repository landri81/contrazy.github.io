import { NextResponse } from "next/server"

import { reviewClientContract } from "@/features/client-flow/server/steps/review-contract"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { reviewed } = await request.json()

    if (!reviewed) {
      return NextResponse.json({ success: false, message: "Contract review confirmation is required" }, { status: 400 })
    }

    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: false, message: "This secure link is no longer available." }, { status: 410 })
    }

    const result = await reviewClientContract(linkContext.link)

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Save Contract Review Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save contract review" }, { status: 500 })
  }
}
