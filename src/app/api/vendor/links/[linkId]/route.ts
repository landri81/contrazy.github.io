import { NextResponse } from "next/server"

import { buildVendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import { vendorLinkUpdateSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { remainingQrCodes } from "@/features/subscriptions/server/feature-gates"
import { isEditableLinkStatus } from "@/features/transactions/server/transaction-links"
import { ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export async function PATCH(
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
    const body = await request.json()
    const parsedBody = vendorLinkUpdateSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid payment link data." },
        { status: 400 }
      )
    }

    const { title, notes, expiresAt } = parsedBody.data

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

    if (!isEditableLinkStatus(current.link.status)) {
      return NextResponse.json({ success: false, message: "Only active links can be edited." }, { status: 409 })
    }

    let nextExpiry: Date | null = null
    if (typeof expiresAt === "string" && expiresAt.trim()) {
      const parsed = new Date(expiresAt)

      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, message: "Expiry date is invalid." }, { status: 422 })
      }

      if (parsed.getTime() <= Date.now()) {
        return NextResponse.json({ success: false, message: "Expiry must be set in the future." }, { status: 422 })
      }

      nextExpiry = parsed
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: current.id },
        data: {
          title,
          notes,
        },
      })

      await tx.transactionLink.update({
        where: { id: current.link!.id },
        data: {
          expiresAt: nextExpiry,
        },
      })

      await tx.transactionEvent.create({
        data: {
          transactionId: current.id,
          type: "LINK_UPDATED",
          title: "Secure link updated",
          detail: "The vendor updated the link details.",
          metadata: {
            expiresAt: nextExpiry?.toISOString() ?? null,
          },
        },
      })

      return tx.transaction.findUnique({
        where: { id: current.id },
        include: {
          clientProfile: { select: { fullName: true, email: true } },
          link: true,
        },
      })
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
    console.error("Update Vendor Link Error:", error)
    return NextResponse.json({ success: false, message: "Failed to update this payment link" }, { status: 500 })
  }
}
