import { NextResponse } from "next/server"
import { TransactionLinkActor } from "@prisma/client"

import { buildVendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import { vendorLinkCancelSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { remainingQrCodes } from "@/features/subscriptions/server/feature-gates"
import { cancelTransactionLink } from "@/features/transactions/server/transaction-links"
import { ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response, subscription } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const { linkId } = await params
    const body = await request.json().catch(() => ({}))
    const parsedBody = vendorLinkCancelSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid cancellation reason." },
        { status: 400 }
      )
    }

    const { reason } = parsedBody.data

    const current = await prisma.transaction.findFirst({
      where: {
        vendorId: vendorProfile.id,
        link: {
          is: { id: linkId },
        },
      },
      include: {
        clientProfile: { select: { fullName: true, email: true } },
        link: true,
      },
    })

    if (!current?.link) {
      return NextResponse.json({ success: false, message: "Payment link not found" }, { status: 404 })
    }

    const result = await cancelTransactionLink(prisma, {
      linkId: current.link.id,
      actor: TransactionLinkActor.VENDOR,
      reason,
      detail: "The vendor cancelled this secure link before the workflow was completed.",
      title: "Vendor cancelled the secure link",
    })

    if (!result.ok) {
      return NextResponse.json({ success: false, message: "This payment link cannot be cancelled." }, { status: 409 })
    }

    const updated = await prisma.transaction.findUnique({
      where: { id: current.id },
      include: {
        clientProfile: { select: { fullName: true, email: true } },
        link: true,
      },
    })

    if (!updated?.link) {
      return NextResponse.json({ success: false, message: "Payment link not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      item: buildVendorLinkRecord({
        id: updated.id,
        reference: updated.reference,
        title: updated.title,
        kind: updated.kind,
        amount: updated.amount,
        depositAmount: updated.depositAmount,
        currency: updated.currency,
        notes: updated.notes,
        updatedAt: updated.updatedAt,
        clientProfile: updated.clientProfile,
        link: updated.link,
      }, { qrRemaining: remainingQrCodes(subscription) }),
    })
  } catch (error) {
    console.error("Cancel Vendor Link Error:", error)
    return NextResponse.json({ success: false, message: "Failed to cancel this payment link" }, { status: 500 })
  }
}
