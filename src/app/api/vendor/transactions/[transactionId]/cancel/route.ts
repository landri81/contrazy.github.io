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
    const activeStatuses = ["AUTHORIZED", "SUCCEEDED"]
    const depositIsActive = depositAuth && activeStatuses.includes(depositAuth.status)

    if (!depositIsActive) {
      return NextResponse.json(
        {
          success: false,
          message: "Only transactions with an active deposit can be cancelled from this screen.",
        },
        { status: 400 }
      )
    }

    const isChargeRefund = depositAuth.depositStrategy === "CHARGE_REFUND"
    let depositRefundId: string | null = null

    await prisma.$transaction(async (tx) => {
      if (depositAuth.stripeIntentId) {
        try {
          if (isChargeRefund) {
            const refund = await stripe.refunds.create(
              {
                payment_intent: depositAuth.stripeIntentId,
                reason: "requested_by_customer",
                refund_application_fee: true,
              },
              getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)
            )
            depositRefundId = refund.id
          } else {
            await stripe.paymentIntents.cancel(
              depositAuth.stripeIntentId,
              {},
              getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)
            )
          }
        } catch (stripeErr) {
          console.warn("Stripe operation failed during transaction cancel:", stripeErr)
        }
      }

      await tx.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: {
          status: "CANCELLED",
          releasedAt: new Date(),
          ...(isChargeRefund && depositRefundId
            ? { depositRefundedAt: new Date(), depositRefundId }
            : {}),
        },
      })

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status: "CANCELLED" },
      })
    })

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
      locale: transaction.locale,
    })

    await recordFinanceAuditLog(prisma, {
      actorId: dbUser.id,
      actorType,
      action: isChargeRefund
        ? "Cancelled transaction and refunded deposit charge"
        : "Cancelled transaction and released deposit hold",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: {
        transactionId: transaction.id,
        depositAuthorizationId: depositAuth.id,
        depositStrategy: depositAuth.depositStrategy,
        releaseReason: "transaction_cancelled",
        depositStatusAfterRelease: "CANCELLED",
        amount: depositAuth.amount,
        currency: depositAuth.currency,
        stripeIntentId: depositAuth.stripeIntentId ?? null,
        depositRefundId: depositRefundId ?? null,
      },
    })

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "TRANSACTION_CANCELLED",
      title: "Transaction cancelled",
      detail: isChargeRefund
        ? "Transaction cancelled and deposit charge refunded."
        : "Transaction cancelled and deposit hold released.",
      dedupeKey: `event:cancelled:${transaction.id}`,
      metadata: {
        hadActiveDeposit: true,
        depositStrategy: depositAuth.depositStrategy,
        depositReleaseReason: "transaction_cancelled",
        stripeIntentId: depositAuth.stripeIntentId ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Cancel Transaction Error:", error)
    return NextResponse.json({ success: false, message: "Failed to cancel transaction" }, { status: 500 })
  }
}
