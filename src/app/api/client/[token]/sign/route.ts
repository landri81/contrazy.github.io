import { NextResponse } from "next/server"

import { clientFlowTransactionInclude, getNextClientStep } from "@/features/client-flow/server/client-flow-data"
import { completeTransactionWithoutPayment } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const link = await prisma.transactionLink.findUnique({
      where: { token },
      include: { transaction: { include: { clientProfile: true } } },
    })

    if (!link?.transaction) {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    const { agreed } = await request.json()

    if (!agreed) {
      return NextResponse.json({ success: false, message: "Signature required" }, { status: 400 })
    }

    const forwardedFor = request.headers.get("x-forwarded-for")
    const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null

    await prisma.$transaction(async (tx) => {
      await tx.signatureRecord.upsert({
        where: { transactionId: link.transaction.id },
        update: {
          status: "SIGNED",
          signerName: link.transaction.clientProfile?.fullName || "Unknown",
          signerEmail: link.transaction.clientProfile?.email || "Unknown",
          method: "Checkbox Acceptance",
          ipAddress,
          signedAt: new Date(),
        },
        create: {
          transactionId: link.transaction.id,
          status: "SIGNED",
          signerName: link.transaction.clientProfile?.fullName || "Unknown",
          signerEmail: link.transaction.clientProfile?.email || "Unknown",
          method: "Checkbox Acceptance",
          ipAddress,
          signedAt: new Date(),
        },
      })

      await tx.transaction.update({
        where: { id: link.transaction.id },
        data: { status: "SIGNED" },
      })

      await recordTransactionEvent(tx, {
        transactionId: link.transaction.id,
        type: "SIGNATURE_COMPLETED",
        title: "Agreement signed",
        detail: `${link.transaction.clientProfile?.fullName || "Client"} confirmed the agreement.`,
        dedupeKey: `event:signature:${link.transaction.id}`,
      })
    })

    const transaction = await prisma.transaction.findUnique({
      where: { id: link.transaction.id },
      include: clientFlowTransactionInclude,
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    const nextStep = getNextClientStep(transaction)

    if (nextStep === "complete") {
      await completeTransactionWithoutPayment(prisma, transaction.id)
    }

    return NextResponse.json({ success: true, nextStep })
  } catch (error) {
    console.error("Save Signature Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save signature" }, { status: 500 })
  }
}
