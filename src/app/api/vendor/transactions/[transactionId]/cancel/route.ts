import { NextResponse } from "next/server"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
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

    if (blockedResponse) return blockedResponse

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: { depositAuthorization: true, vendor: true },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    if (transaction.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, message: "Transaction is already cancelled" },
        { status: 409 }
      )
    }

    if (transaction.status === "COMPLETED") {
      return NextResponse.json(
        { success: false, message: "Cannot cancel a completed transaction" },
        { status: 400 }
      )
    }

    const depositAuth = transaction.depositAuthorization

    await prisma.$transaction(async (tx) => {
      // Release the Stripe hold if deposit is still authorized
      if (depositAuth?.status === "AUTHORIZED" && depositAuth.stripeIntentId) {
        try {
          await stripe.paymentIntents.cancel(
            depositAuth.stripeIntentId,
            {},
            getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)
          )
        } catch (stripeErr) {
          console.warn("Stripe cancel intent failed during transaction cancel:", stripeErr)
        }

        await tx.depositAuthorization.update({
          where: { id: depositAuth.id },
          data: { status: "CANCELLED", releasedAt: new Date() },
        })
      }

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "CANCELLED" },
      })

      await recordTransactionEvent(tx, {
        transactionId: transaction.id,
        type: "TRANSACTION_CANCELLED",
        title: "Transaction cancelled",
        detail: depositAuth?.status === "AUTHORIZED"
          ? "Transaction cancelled and deposit hold released."
          : "Transaction cancelled.",
        dedupeKey: `event:cancelled:${transaction.id}`,
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Cancel Transaction Error:", error)
    return NextResponse.json({ success: false, message: "Failed to cancel transaction" }, { status: 500 })
  }
}
