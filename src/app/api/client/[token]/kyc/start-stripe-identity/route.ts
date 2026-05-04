import { NextResponse } from "next/server"

import { canUseKyc, getKycProvider, remainingKycVerifications } from "@/features/subscriptions/server/feature-gates"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
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

    // Plain return URL — no Stripe template variable. The session ID is stored in
    // the database at creation so the return page and webhooks can look it up
    // without depending on URL parameters (the {VERIFICATION_SESSION_ID} placeholder
    // is only substituted by Stripe in mobile SDKs, not the hosted web redirect).
    const returnUrl = `${baseUrl}/t/${token}/kyc/return`

    // Create the VerificationSession on the PLATFORM Stripe account.
    // Stripe Identity is platform-level; the vendor's Connect account is for payments
    // and may not have Identity permissions granted.
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      return_url: returnUrl,
      metadata: {
        transactionId: transaction.id,
        vendorId: transaction.vendorId,
        token,
      },
    })

    if (!session.url) {
      return NextResponse.json(
        { success: false, message: "Failed to create verification session." },
        { status: 500 }
      )
    }

    // Store session ID immediately so the return page never needs to trust URL params.
    // Upsert handles the case where the customer starts a new session after a failure.
    await prisma.$transaction(async (tx) => {
      await tx.kycVerification.upsert({
        where: { transactionId: transaction.id },
        create: {
          transactionId: transaction.id,
          provider: "Stripe Identity",
          status: "PENDING",
          providerReference: session.id,
        },
        update: {
          status: "PENDING",
          providerReference: session.id,
          verifiedAt: null,
          summary: null,
        },
      })

      await recordTransactionEvent(tx, {
        transactionId: transaction.id,
        type: "KYC_STARTED",
        title: "Identity verification started",
        detail: "Customer redirected to Stripe Identity for document verification.",
        dedupeKey: `event:kyc-started:${transaction.id}:${session.id}`,
      })
    })

    return NextResponse.json({ success: true, url: session.url })
  } catch (error) {
    console.error("Stripe Identity start error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to start identity verification." },
      { status: 500 }
    )
  }
}
