import { NextResponse } from "next/server"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { isAdminRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { session, dbUser, vendorProfile } = await requireVendorProfileAccess()
    const body = await request.json() as { action?: string }
    const { action } = body

    if (!action || !["approve", "reject", "request_again"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid action. Use approve, reject, or request_again." },
        { status: 422 }
      )
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { kycVerification: true, vendor: true },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found." }, { status: 404 })
    }

    const isAdmin = isAdminRole(session.user.role)
    if (!isAdmin && transaction.vendor?.userId !== dbUser.id) {
      return NextResponse.json({ success: false, message: "Not authorized." }, { status: 403 })
    }

    const kyc = transaction.kycVerification
    if (!kyc) {
      return NextResponse.json(
        { success: false, message: "No KYC verification record found for this transaction." },
        { status: 404 }
      )
    }

    if (kyc.provider !== "Manual") {
      return NextResponse.json(
        { success: false, message: "Manual review actions are only available for manually submitted documents." },
        { status: 422 }
      )
    }

    if (kyc.status !== "PENDING" && action !== "request_again") {
      return NextResponse.json(
        { success: false, message: `Cannot ${action} a verification that is already ${kyc.status}.` },
        { status: 422 }
      )
    }

    await prisma.$transaction(async (tx) => {
      if (action === "approve") {
        await tx.kycVerification.update({
          where: { id: kyc.id },
          data: { status: "VERIFIED", verifiedAt: new Date() },
        })
        await tx.transaction.update({
          where: { id: transactionId },
          data: { status: "KYC_VERIFIED" },
        })
        await recordTransactionEvent(tx, {
          transactionId,
          type: "KYC_VERIFIED",
          title: "Identity verification approved",
          detail: `Document manually approved by ${vendorProfile.businessName ?? "vendor"}.`,
          dedupeKey: `event:kyc-verified:${transactionId}`,
        })
      } else if (action === "reject") {
        await tx.kycVerification.update({
          where: { id: kyc.id },
          data: { status: "FAILED" },
        })
        await recordTransactionEvent(tx, {
          transactionId,
          type: "KYC_FAILED",
          title: "Identity verification rejected",
          detail: `Document rejected by ${vendorProfile.businessName ?? "vendor"}.`,
          dedupeKey: `event:kyc-failed:${transactionId}`,
        })
      } else {
        // request_again: delete verification so client can re-upload
        await tx.kycVerification.delete({ where: { id: kyc.id } })
        await tx.transaction.update({
          where: { id: transactionId },
          data: { status: "CUSTOMER_STARTED" },
        })
        await recordTransactionEvent(tx, {
          transactionId,
          type: "KYC_FAILED",
          title: "New identity document requested",
          detail: `Vendor requested the client to resubmit their identity document.`,
          dedupeKey: `event:kyc-failed:${transactionId}`,
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Vendor KYC review error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to process KYC review action." },
      { status: 500 }
    )
  }
}
