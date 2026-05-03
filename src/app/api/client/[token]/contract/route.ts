import { NextResponse } from "next/server"

import { clientFlowTransactionInclude, getNextClientStep } from "@/features/client-flow/server/client-flow-data"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext, markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

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

    const { link } = linkContext
    const transactionId = link.transaction.id

    await markTransactionLinkOpened(prisma, { linkId: link.id, transactionId })

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "CONTRACT_GENERATED" },
    })

    await recordTransactionEvent(prisma, {
      transactionId,
      type: "CONTRACT_REVIEWED",
      title: "Agreement reviewed",
      detail: "The client reviewed the populated agreement.",
      dedupeKey: `event:contract-reviewed:${transactionId}`,
    })

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: clientFlowTransactionInclude,
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, nextStep: getNextClientStep(transaction) })
  } catch (error) {
    console.error("Save Contract Review Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save contract review" }, { status: 500 })
  }
}
