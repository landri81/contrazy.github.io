import { NextResponse } from "next/server"
import { TransactionFlowType, TransactionReportStatus, TransactionReportType } from "@prisma/client"

import {
  clientFlowTransactionInclude,
  hasSubmittedCheckIn,
  hasSubmittedCheckOut,
  isCheckInOutFlow,
} from "@/features/client-flow/server/client-flow-data"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import {
  ensureVendorApproved,
  ensureVendorSubscriptionEligible,
  requireVendorProfileAccess,
} from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) return response

    const blockedResponse = ensureVendorApproved(vendorProfile)
    if (blockedResponse) return blockedResponse

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: clientFlowTransactionInclude,
    })

    if (!transaction?.link) {
      return NextResponse.json({ success: false, message: "Transaction not found." }, { status: 404 })
    }

    if (!isCheckInOutFlow(transaction)) {
      return NextResponse.json(
        { success: false, message: "This transaction does not have a check-in/out flow." },
        { status: 422 }
      )
    }

    if (!hasSubmittedCheckIn(transaction)) {
      return NextResponse.json(
        { success: false, message: "Check-in must be submitted before checkout can be requested." },
        { status: 422 }
      )
    }

    if (hasSubmittedCheckOut(transaction)) {
      return NextResponse.json({ success: false, message: "Check-out has already been submitted." }, { status: 409 })
    }

    if (transaction.checkOutRequestedAt) {
      return NextResponse.json({ success: true, alreadyRequested: true })
    }

    const requestedAt = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { checkOutRequestedAt: requestedAt },
      })

      // Pre-create the CHECK_OUT report in PENDING state so it exists
      await tx.transactionReport.upsert({
        where: { transactionId_type: { transactionId, type: TransactionReportType.CHECK_OUT } },
        update: {},
        create: {
          transactionId,
          type: TransactionReportType.CHECK_OUT,
          status: TransactionReportStatus.PENDING,
        },
      })

      await recordTransactionEvent(tx, {
        transactionId,
        type: "CHECK_OUT_REQUESTED",
        title: "Checkout requested",
        detail: "The vendor has requested the customer complete the check-out report.",
        dedupeKey: `event:check-out-requested:${transactionId}`,
        occurredAt: requestedAt,
        metadata: { requestedAt: requestedAt.toISOString() },
      })
    })

    // Optionally email the customer (non-blocking, best-effort)
    if (transaction.clientProfile?.email && transaction.link) {
      const checkOutUrl = `${getAppBaseUrl()}/${transaction.locale}/t/${transaction.link.token}/check-out`
      try {
        const { sendCheckOutRequestEmail } = await import("@/lib/integrations/resend")
        const sent = await sendCheckOutRequestEmail(
          transaction.clientProfile.email,
          transaction.clientProfile.fullName,
          transaction.vendor?.businessName ?? "Vendor",
          transaction.reference,
          checkOutUrl,
          transaction.locale
        )
        if (sent) {
          await recordTransactionEvent(prisma, {
            transactionId,
            type: "EMAIL_SENT",
            title: "Email sent",
            detail: `Check-out request sent to ${transaction.clientProfile.email}.`,
            dedupeKey: `email:check-out-requested:${transactionId}:${transaction.clientProfile.email.toLowerCase()}`,
          })
        }
      } catch {
        // Email is best-effort
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Request Checkout Error:", error)
    return NextResponse.json({ success: false, message: "Failed to request checkout." }, { status: 500 })
  }
}
