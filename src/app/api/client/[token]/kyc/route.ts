import { NextResponse } from "next/server"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl, getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const link = await prisma.transactionLink.findUnique({
      where: { token },
      include: {
        transaction: {
          include: {
            vendor: true,
          },
        },
      },
    })

    if (!link?.transaction?.vendor?.stripeAccountId) {
      return NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 })
    }

    const { transaction } = link
    const origin = getAppBaseUrl()

    const verificationSession = await stripe.identity.verificationSessions.create(
      {
        type: "document",
        metadata: {
          transactionId: transaction.id,
          vendorId: transaction.vendorId,
        },
        return_url: `${origin}/t/${token}/kyc/return?session_id={VERIFICATION_SESSION_ID}`,
      },
      getConnectedAccountRequestOptions(transaction.vendor.stripeAccountId)
    )

    await prisma.$transaction(async (tx) => {
      await tx.kycVerification.upsert({
        where: { transactionId: transaction.id },
        update: {
          status: "PENDING",
          provider: "Stripe Identity",
          providerReference: verificationSession.id,
        },
        create: {
          transactionId: transaction.id,
          provider: "Stripe Identity",
          status: "PENDING",
          providerReference: verificationSession.id,
        },
      })

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "CUSTOMER_STARTED" },
      })

      await recordTransactionEvent(tx, {
        transactionId: transaction.id,
        type: "KYC_STARTED",
        title: "Identity verification started",
        detail: "Stripe Identity session created for the client.",
        dedupeKey: `event:kyc-started:${transaction.id}`,
      })
    })

    return NextResponse.json({ success: true, url: verificationSession.url })
  } catch (error) {
    console.error("Create KYC Session Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create verification session" }, { status: 500 })
  }
}
