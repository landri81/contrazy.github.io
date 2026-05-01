import { NextResponse } from "next/server"
import { requireVendorAccess } from "@/lib/auth/guards"
import { stripe } from "@/lib/integrations/stripe"
import { prisma } from "@/lib/db/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { session, dbUser } = await requireVendorAccess()

    if (!dbUser?.vendorProfile) {
      return NextResponse.json({ success: false, message: "Vendor profile not found" }, { status: 404 })
    }

    const { action } = await request.json()

    if (action !== "release" && action !== "capture") {
      return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
    }

    const transaction = await prisma.transaction.findUnique({
      where: { 
        id: transactionId,
        vendorId: dbUser.vendorProfile.id 
      },
      include: {
        depositAuthorization: true,
        vendor: true
      }
    })

    if (!transaction || !transaction.depositAuthorization) {
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
      // Cancel the payment intent
      await stripe.paymentIntents.cancel(depositAuth.stripeIntentId, {
        stripeAccount: transaction.vendor.stripeAccountId || undefined
      })

      await prisma.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: { 
          status: "RELEASED",
          releasedAt: new Date()
        }
      })
    } else if (action === "capture") {
      // Capture the payment intent
      await stripe.paymentIntents.capture(depositAuth.stripeIntentId, {
        stripeAccount: transaction.vendor.stripeAccountId || undefined
      })

      await prisma.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: { 
          status: "CAPTURED",
          capturedAt: new Date()
        }
      })

      // Also create a payment record for the capture
      await prisma.payment.create({
        data: {
          transactionId: transaction.id,
          kind: "DEPOSIT_CAPTURE",
          status: "SUCCEEDED",
          amount: depositAuth.amount,
          currency: depositAuth.currency,
          stripeIntentId: depositAuth.stripeIntentId,
          processedAt: new Date()
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Deposit Action Error:", error)
    return NextResponse.json({ success: false, message: "Failed to process deposit action" }, { status: 500 })
  }
}
