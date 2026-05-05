import { NextResponse } from "next/server"
import { AuditActorType } from "@prisma/client"

import {
  recordDepositOutcome,
  recordFinanceAuditLog,
} from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
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
    const { dbUser, session, vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) return response

    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) return blockedResponse
    const actorType =
      session.user.role === "SUPER_ADMIN" ? AuditActorType.SUPER_ADMIN : AuditActorType.USER

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: { depositAuthorization: true, vendor: true, clientProfile: true },
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

    const depositAuth = transaction.depositAuthorization

    if (depositAuth?.status !== "AUTHORIZED") {
      return NextResponse.json(
        {
          success: false,
          message: "Only transactions with an active deposit hold can be cancelled from this screen.",
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      // Release the Stripe hold if deposit is still authorized
      if (depositAuth?.status === "AUTHORIZED") {
        if (depositAuth.stripeIntentId) {
          try {
            await stripe.paymentIntents.cancel(
              depositAuth.stripeIntentId,
              {},
              getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)
            )
          } catch (stripeErr) {
            console.warn("Stripe cancel intent failed during transaction cancel:", stripeErr)
          }
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
    })

    if (depositAuth?.status === "AUTHORIZED") {
      await recordDepositOutcome(prisma, {
        transactionId: transaction.id,
        amount: depositAuth.amount,
        actualAmount: depositAuth.amount,
        currency: depositAuth.currency,
        stripeIntentId: depositAuth.stripeIntentId,
        action: "release",
        reason: "transaction_cancelled",
        vendorBusinessEmail: transaction.vendor?.businessEmail,
        vendorBusinessName: transaction.vendor?.businessName,
        clientFullName: transaction.clientProfile?.fullName,
        clientEmail: transaction.clientProfile?.email,
      })

      await recordFinanceAuditLog(prisma, {
        actorId: dbUser.id,
        actorType,
        action: "Cancelled transaction and released deposit hold",
        entityType: "Transaction",
        entityId: transaction.id,
        metadata: {
          transactionId: transaction.id,
          depositAuthorizationId: depositAuth.id,
          releaseReason: "transaction_cancelled",
          depositStatusAfterRelease: "CANCELLED",
          amount: depositAuth.amount,
          currency: depositAuth.currency,
          stripeIntentId: depositAuth.stripeIntentId ?? null,
        },
      })
    }

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "TRANSACTION_CANCELLED",
      title: "Transaction cancelled",
      detail: depositAuth?.status === "AUTHORIZED"
        ? "Transaction cancelled and deposit hold released."
        : "Transaction cancelled.",
      dedupeKey: `event:cancelled:${transaction.id}`,
      metadata: {
        hadAuthorizedDeposit: depositAuth?.status === "AUTHORIZED",
        depositReleaseReason: depositAuth?.status === "AUTHORIZED" ? "transaction_cancelled" : null,
        stripeIntentId: depositAuth?.stripeIntentId ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Cancel Transaction Error:", error)
    return NextResponse.json({ success: false, message: "Failed to cancel transaction" }, { status: 500 })
  }
}
