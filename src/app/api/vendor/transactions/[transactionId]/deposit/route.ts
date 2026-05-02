import { NextResponse } from "next/server"

import { recordDepositOutcome } from "@/features/transactions/server/transaction-finance"
import { ensureVendorApproved, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }
    const { action } = await request.json()

    if (action !== "release" && action !== "capture") {
      return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        vendorId: vendorProfile.id,
      },
      include: {
        depositAuthorization: true,
        vendor: true,
        clientProfile: true,
      },
    })

    if (!transaction?.depositAuthorization) {
      return NextResponse.json({ success: false, message: "Transaction or deposit not found" }, { status: 404 })
    }

    const depositAuth = transaction.depositAuthorization

    if (depositAuth.status !== "AUTHORIZED") {
      return NextResponse.json({ success: false, message: "Deposit is not in an authorized state" }, { status: 400 })
    }

    if (!depositAuth.stripeIntentId) {
      return NextResponse.json({ success: false, message: "Missing Stripe Payment Intent" }, { status: 400 })
    }

    if (action === "release") {
      await stripe.paymentIntents.cancel(
        depositAuth.stripeIntentId,
        {},
        getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)
      )

      await prisma.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      })
    } else {
      await stripe.paymentIntents.capture(
        depositAuth.stripeIntentId,
        {},
        getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)
      )

      await prisma.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: {
          status: "CAPTURED",
          capturedAt: new Date(),
        },
      })
    }

    await recordDepositOutcome(prisma, {
      transactionId: transaction.id,
      amount: depositAuth.amount,
      currency: depositAuth.currency,
      stripeIntentId: depositAuth.stripeIntentId,
      action,
      vendorBusinessEmail: transaction.vendor?.businessEmail,
      vendorBusinessName: transaction.vendor?.businessName,
      clientFullName: transaction.clientProfile?.fullName,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Deposit Action Error:", error)
    return NextResponse.json({ success: false, message: "Failed to process deposit action" }, { status: 500 })
  }
}
