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
      include: { transaction: true },
    })

    if (!link?.transaction) {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    const { fullName, email, phone, companyName } = await request.json()

    if (!fullName || !email) {
      return NextResponse.json({ success: false, message: "Name and email are required" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      let clientProfileId = link.transaction.clientProfileId

      if (clientProfileId) {
        await tx.clientProfile.update({
          where: { id: clientProfileId },
          data: {
            fullName,
            email,
            phone,
            companyName,
          },
        })
      } else {
        const newProfile = await tx.clientProfile.create({
          data: {
            vendorId: link.transaction.vendorId,
            fullName,
            email,
            phone,
            companyName,
          },
        })

        clientProfileId = newProfile.id
      }

      await tx.transaction.update({
        where: { id: link.transaction.id },
        data: {
          clientProfileId,
          status: "CUSTOMER_STARTED",
        },
      })

      await recordTransactionEvent(tx, {
        transactionId: link.transaction.id,
        type: "PROFILE_SUBMITTED",
        title: "Client profile submitted",
        detail: `${fullName} shared contact details.`,
        dedupeKey: `event:profile:${link.transaction.id}`,
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
    console.error("Save Profile Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save profile" }, { status: 500 })
  }
}
