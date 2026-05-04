import { NextResponse } from "next/server"

import { canUseKyc, getKycProvider, remainingKycVerifications } from "@/features/subscriptions/server/feature-gates"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl, stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

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
      include: {
        transaction: {
          include: { vendor: true },
        },
      },
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
        { success: false, message: "Identity verification is not available for this vendor." },
        { status: 422 }
      )
    }

    if (getKycProvider(subscription) !== "stripe_identity") {
      return NextResponse.json(
        { success: false, message: "Stripe Identity is not available on this plan." },
        { status: 422 }
      )
    }

    const remaining = remainingKycVerifications(subscription)
    if (remaining !== null && remaining <= 0) {
      return NextResponse.json(
        { success: false, message: "The vendor has reached the KYC quota for this billing period." },
        { status: 422 }
      )
    }

    const baseUrl = getAppBaseUrl()
    const returnUrl = `${baseUrl}/t/${token}/kyc/return?session_id={VERIFICATION_SESSION_ID}`

    const session = await stripe.identity.verificationSessions.create(
      {
        type: "document",
        return_url: returnUrl,
        metadata: { transactionId: transaction.id, token },
      },
    )

    if (!session.url) {
      return NextResponse.json(
        { success: false, message: "Failed to create verification session." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, url: session.url })
  } catch (error) {
    console.error("Stripe Identity start error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to start identity verification." },
      { status: 500 }
    )
  }
}
