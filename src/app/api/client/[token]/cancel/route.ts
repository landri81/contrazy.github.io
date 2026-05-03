import { NextResponse } from "next/server"

import { cancelTransactionLink, getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { TransactionLinkActor } from "@prisma/client"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: true, redirectUrl: `/t/${token}/cancelled` })
    }

    const result = await cancelTransactionLink(prisma, {
      linkId: linkContext.link.id,
      actor: TransactionLinkActor.CLIENT,
      reason: "Cancelled by customer",
      detail: "The customer cancelled the secure link before completing the workflow.",
      title: "Customer cancelled the secure link",
    })

    if (!result.ok) {
      return NextResponse.json({ success: false, message: "This secure link can no longer be cancelled." }, { status: 409 })
    }

    return NextResponse.json({ success: true, redirectUrl: `/t/${token}/cancelled` })
  } catch (error) {
    console.error("Cancel Client Link Error:", error)
    return NextResponse.json({ success: false, message: "Failed to cancel this link" }, { status: 500 })
  }
}
