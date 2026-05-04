import { NextResponse } from "next/server"
import QRCode from "qrcode"

import { buildVendorActionsUsage, buildVendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import { remainingQrCodes } from "@/features/subscriptions/server/feature-gates"
import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { isLiveLinkStatus } from "@/features/transactions/server/transaction-links"
import { ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl } from "@/lib/integrations/stripe"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response, subscription } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response || !subscription) {
      return response ?? NextResponse.json({ success: false, message: "Subscription required." }, { status: 402 })
    }

    const { linkId } = await params
    const current = await prisma.transaction.findFirst({
      where: {
        vendorId: vendorProfile.id,
        link: { is: { id: linkId } },
      },
      include: {
        clientProfile: { select: { fullName: true, email: true } },
        link: true,
      },
    })

    if (!current?.link) {
      return NextResponse.json({ success: false, message: "Payment link not found." }, { status: 404 })
    }

    if (current.link.qrCodeSvg) {
      return NextResponse.json({
        success: true,
        item: buildVendorLinkRecord({
          id: current.id,
          reference: current.reference,
          title: current.title,
          kind: current.kind,
          amount: current.amount,
          depositAmount: current.depositAmount,
          currency: current.currency,
          notes: current.notes,
          updatedAt: current.updatedAt,
          clientProfile: current.clientProfile,
          link: current.link,
        }, { qrRemaining: remainingQrCodes(subscription) }),
        actionUsage: buildVendorActionsUsage(subscription),
      })
    }

    if (!isLiveLinkStatus(current.link.status)) {
      return NextResponse.json(
        { success: false, message: "QR can only be generated for active or processing links." },
        { status: 409 }
      )
    }

    if ((remainingQrCodes(subscription) ?? 1) <= 0) {
      return NextResponse.json(
        { success: false, message: "Your current plan has reached its monthly QR code limit. Upgrade to generate more." },
        { status: 422 }
      )
    }

    const shareLink = `${getAppBaseUrl()}/t/${current.link.token}`
    const qrCodeSvg = await QRCode.toString(shareLink, { type: "svg", margin: 1 })

    const result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.transactionLink.updateMany({
        where: {
          id: current.link!.id,
          qrCodeSvg: null,
        },
        data: {
          qrCodeSvg,
        },
      })

      if (updateResult.count > 0) {
        await incrementVendorSubscriptionUsage(tx, vendorProfile.id, "qrCodesUsed")
        await recordTransactionEvent(tx, {
          transactionId: current.id,
          type: "LINK_UPDATED",
          title: "QR code generated",
          detail: "The vendor generated a QR code for this secure link.",
          dedupeKey: `event:link-qr-generated:${current.id}`,
        })
      }

      const [transaction, updatedSubscription] = await Promise.all([
        tx.transaction.findUnique({
          where: { id: current.id },
          include: {
            clientProfile: { select: { fullName: true, email: true } },
            link: true,
          },
        }),
        tx.vendorSubscription.findUnique({
          where: { vendorId: vendorProfile.id },
        }),
      ])

      return { transaction, updatedSubscription }
    })

    if (!result.transaction?.link || !result.updatedSubscription) {
      return NextResponse.json({ success: false, message: "Unable to load the updated payment link." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item: buildVendorLinkRecord({
        id: result.transaction.id,
        reference: result.transaction.reference,
        title: result.transaction.title,
        kind: result.transaction.kind,
        amount: result.transaction.amount,
        depositAmount: result.transaction.depositAmount,
        currency: result.transaction.currency,
        notes: result.transaction.notes,
        updatedAt: result.transaction.updatedAt,
        clientProfile: result.transaction.clientProfile,
        link: result.transaction.link,
      }, { qrRemaining: remainingQrCodes(result.updatedSubscription) }),
      actionUsage: buildVendorActionsUsage(result.updatedSubscription),
    })
  } catch (error) {
    console.error("Generate Vendor Link QR Error:", error)
    return NextResponse.json({ success: false, message: "Failed to generate this QR code." }, { status: 500 })
  }
}
