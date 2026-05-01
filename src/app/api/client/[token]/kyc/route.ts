import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

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
            vendor: true
          }
        }
      }
    })

    if (!link || !link.transaction || !link.transaction.vendor.stripeAccountId) {
      return NextResponse.json({ success: false, message: "Invalid transaction" }, { status: 404 })
    }

    const { transaction } = link
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    // Create Stripe Identity VerificationSession
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        transactionId: transaction.id
      },
      return_url: `${origin}/t/${token}/kyc/return?session_id={VERIFICATION_SESSION_ID}`,
    }, {
      stripeAccount: transaction.vendor.stripeAccountId
    })

    return NextResponse.json({ success: true, url: verificationSession.url })
  } catch (error) {
    console.error("Create KYC Session Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create verification session" }, { status: 500 })
  }
}
