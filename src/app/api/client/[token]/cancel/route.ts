import { NextResponse } from "next/server"

import { TransactionLinkActor, TransactionLinkStatus } from "@prisma/client"

import {
  canCancelClientFlow,
  getTransactionByToken,
} from "@/features/client-flow/server/client-flow-data"
import { cancelTransactionLink } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const transaction = await getTransactionByToken(token)

    if (!transaction?.link) {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    if (transaction.link.status === TransactionLinkStatus.CANCELLED) {
      return NextResponse.json({ success: true, redirectUrl: `/t/${token}/cancelled` })
    }

    if (!canCancelClientFlow(transaction)) {
      return NextResponse.json(
        { success: false, message: "This request has reached its final stage and can no longer be cancelled." },
        { status: 409 }
      )
    }

    const result = await cancelTransactionLink(prisma, {
      linkId: transaction.link.id,
      actor: TransactionLinkActor.CLIENT,
      reason: "Cancelled by customer",
      detail: "The customer cancelled the secure link before completing the workflow.",
      title: "Customer cancelled the secure link",
    })

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: "This request has reached its final stage and can no longer be cancelled." },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, redirectUrl: `/t/${token}/cancelled` })
  } catch (error) {
    console.error("Cancel Client Link Error:", error)
    return NextResponse.json({ success: false, message: "Failed to cancel this link" }, { status: 500 })
  }
}
