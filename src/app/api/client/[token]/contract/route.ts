import { NextResponse } from "next/server"

import { clientFlowTransactionInclude, getNextClientStep } from "@/features/client-flow/server/client-flow-data"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
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

    const link = await prisma.transactionLink.findUnique({
      where: { token },
      include: { transaction: true },
    })

    if (!link?.transaction) {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: link.transaction.id },
        data: { status: "CONTRACT_GENERATED" },
      })

      await recordTransactionEvent(tx, {
        transactionId: link.transaction.id,
        type: "CONTRACT_REVIEWED",
        title: "Agreement reviewed",
        detail: "The client reviewed the populated agreement.",
        dedupeKey: `event:contract-reviewed:${link.transaction.id}`,
      })
    })

    const transaction = await prisma.transaction.findUnique({
      where: { id: link.transaction.id },
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
