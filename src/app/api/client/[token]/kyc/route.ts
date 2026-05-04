import { NextResponse } from "next/server"

import { canUseKyc, remainingKycVerifications } from "@/features/subscriptions/server/feature-gates"
import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext, markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { publicId, secureUrl, originalFilename } = body

    if (!publicId || !secureUrl) {
      return NextResponse.json(
        { success: false, message: "An identity document is required." },
        { status: 400 }
      )
    }

    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid transaction." }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json(
        { success: false, message: "This secure link is no longer available." },
        { status: 410 }
      )
    }

    const link = await prisma.transactionLink.findUnique({
      where: { id: linkContext.link.id },
      include: { transaction: true },
    })

    if (!link?.transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found." }, { status: 404 })
    }

    const { transaction } = link
    const subscription = await prisma.vendorSubscription.findUnique({
      where: { vendorId: transaction.vendorId },
    })

    if (!canUseKyc(subscription)) {
      return NextResponse.json(
        { success: false, message: "Identity verification is not available for this vendor plan." },
        { status: 422 }
      )
    }

    const remainingKyc = remainingKycVerifications(subscription)

    if (remainingKyc !== null && remainingKyc <= 0) {
      return NextResponse.json(
        { success: false, message: "The vendor has reached the included KYC quota for this billing period." },
        { status: 422 }
      )
    }

    const existingVerification = await prisma.kycVerification.findUnique({
      where: { transactionId: transaction.id },
    })

    await markTransactionLinkOpened(prisma, { linkId: link.id, transactionId: transaction.id })

    // provider = "Manual" distinguishes from "Stripe Identity"
    // providerReference = Cloudinary public_id for future asset management
    // summary = secure URL so vendor can view the uploaded document
    await prisma.$transaction(async (tx) => {
      await tx.kycVerification.upsert({
        where: { transactionId: transaction.id },
        create: {
          transactionId: transaction.id,
          provider: "Manual",
          status: "PENDING",
          providerReference: publicId,
          summary: secureUrl,
        },
        update: {
          status: "PENDING",
          provider: "Manual",
          providerReference: publicId,
          summary: secureUrl,
        },
      })

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "CUSTOMER_STARTED" },
      })

      if (!existingVerification) {
        await incrementVendorSubscriptionUsage(tx, transaction.vendorId, "kycVerificationsUsed")
      }

      await recordTransactionEvent(tx, {
        transactionId: transaction.id,
        type: "KYC_STARTED",
        title: "Identity document submitted",
        detail: `Client uploaded document "${originalFilename ?? "ID document"}" for manual review.`,
        dedupeKey: `event:kyc-started:${transaction.id}`,
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("KYC Document Submit Error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to submit identity document." },
      { status: 500 }
    )
  }
}
