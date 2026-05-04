import { NextResponse } from "next/server"

import { vendorDisputeCreateSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { sendAdminDisputeAlert } from "@/lib/integrations/resend"
import { env } from "@/lib/env"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) return response

    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) return blockedResponse

    const body = await request.json()
    const parsedBody = vendorDisputeCreateSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid dispute summary." },
        { status: 400 }
      )
    }

    const { summary } = parsedBody.data

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: { depositAuthorization: true, dispute: true, clientProfile: true },
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
          summary,
          openedAt: new Date(),
        },
      })

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "DISPUTED" },
      })
    })

    const createdDispute = await prisma.dispute.findUnique({ where: { transactionId: transaction.id } })

    try {
      await recordTransactionEvent(prisma, {
        transactionId: transaction.id,
        type: "DISPUTE_OPENED",
        title: "Dispute opened by vendor",
        detail: summary.slice(0, 200),
        dedupeKey: `event:dispute-opened:${transaction.id}`,
      })
    } catch (eventErr) {
      console.warn("Dispute event recording failed (run prisma migrate dev):", eventErr)
    }

    try {
      await sendAdminDisputeAlert(
        env.SUPER_ADMIN_EMAIL,
        vendorProfile.businessName ?? "Unknown vendor",
        transaction.clientProfile?.fullName ?? "Unknown client",
        transaction.reference,
        summary,
        createdDispute?.id ?? transaction.id
      )
    } catch (emailErr) {
      console.warn("Admin dispute alert email failed:", emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Dispute Open Error:", error)
    return NextResponse.json({ success: false, message: "Failed to open dispute" }, { status: 500 })
  }
}
