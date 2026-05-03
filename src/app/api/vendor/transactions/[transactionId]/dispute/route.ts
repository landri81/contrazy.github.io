import { NextResponse } from "next/server"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { ensureVendorApproved, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) return blockedResponse

    const { summary } = await request.json() as { summary: string }

    if (!summary || summary.trim().length < 10) {
      return NextResponse.json(
        { success: false, message: "A description of at least 10 characters is required" },
        { status: 400 }
      )
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: { depositAuthorization: true, dispute: true },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    if (transaction.dispute) {
      return NextResponse.json(
        { success: false, message: "A dispute is already open for this transaction" },
        { status: 409 }
      )
    }

    if (transaction.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, message: "Cannot open a dispute on a cancelled transaction" },
        { status: 400 }
      )
    }

    if (transaction.depositAuthorization?.status !== "AUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "A dispute can only be opened while the deposit hold is still active.",
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.dispute.create({
        data: {
          transactionId: transaction.id,
          status: "OPEN",
          summary: summary.trim(),
          openedAt: new Date(),
        },
      })

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "DISPUTED" },
      })

      await recordTransactionEvent(tx, {
        transactionId: transaction.id,
        type: "DISPUTE_OPENED",
        title: "Dispute opened",
        detail: summary.trim().slice(0, 200),
        dedupeKey: `event:dispute-opened:${transaction.id}`,
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Dispute Open Error:", error)
    return NextResponse.json({ success: false, message: "Failed to open dispute" }, { status: 500 })
  }
}
