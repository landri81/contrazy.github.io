import { NextResponse } from "next/server"
import { AuditActorType } from "@prisma/client"

import {
  calculateCapturedDepositFeeBreakdown,
  recordDepositOutcome,
  recordFinanceAuditLog,
} from "@/features/transactions/server/transaction-finance"
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

    const body = await request.json()
    const { action, captureAmount } = body as { action: string; captureAmount?: number }

    if (action !== "release" && action !== "capture") {
      return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: { depositAuthorization: true, vendor: true, clientProfile: true },
    })

    if (!transaction?.depositAuthorization) {
      return NextResponse.json({ success: false, message: "Transaction or deposit not found" }, { status: 404 })
    }

    const depositAuth = transaction.depositAuthorization
    const actorType =
      session.user.role === "SUPER_ADMIN" ? AuditActorType.SUPER_ADMIN : AuditActorType.USER

    if (depositAuth.status !== "AUTHORIZED") {
      return NextResponse.json({ success: false, message: "Deposit is not in an authorized state" }, { status: 400 })
    }

    if (!depositAuth.stripeIntentId) {
      return NextResponse.json({ success: false, message: "Missing Stripe Payment Intent" }, { status: 400 })
    }

    const stripeOpts = getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)
    let feeBreakdown = null as ReturnType<typeof calculateCapturedDepositFeeBreakdown> | null

    if (action === "release") {
      await stripe.paymentIntents.cancel(depositAuth.stripeIntentId, {}, stripeOpts)

      await prisma.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      })
    } else {
      // Validate partial capture amount
      const partialCents = captureAmount ? Math.round(captureAmount) : undefined

      if (partialCents !== undefined) {
        if (partialCents <= 0 || partialCents > depositAuth.amount) {
          return NextResponse.json(
            { success: false, message: "Invalid capture amount" },
            { status: 400 }
          )
        }
      }

      const capturedAmount = partialCents ?? depositAuth.amount
      feeBreakdown = calculateCapturedDepositFeeBreakdown(capturedAmount)

      await stripe.paymentIntents.capture(
        depositAuth.stripeIntentId,
        {
          ...(partialCents ? { amount_to_capture: partialCents } : {}),
          application_fee_amount: feeBreakdown.platformFeeAmount,
        },
        stripeOpts
      )

      await prisma.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: { status: "CAPTURED", capturedAt: new Date() },
      })
    }

    const actualAmount = action === "capture" && captureAmount
      ? Math.round(captureAmount)
      : depositAuth.amount

    await recordDepositOutcome(prisma, {
      transactionId: transaction.id,
      amount: depositAuth.amount,
      actualAmount,
      currency: depositAuth.currency,
      stripeIntentId: depositAuth.stripeIntentId,
      action,
      reason: action === "capture" ? "manual_capture" : "manual_release",
      vendorBusinessEmail: transaction.vendor?.businessEmail,
      vendorBusinessName: transaction.vendor?.businessName,
      clientFullName: transaction.clientProfile?.fullName,
      clientEmail: transaction.clientProfile?.email,
    })

    await recordFinanceAuditLog(prisma, {
      actorId: dbUser.id,
      actorType,
      action: action === "capture" ? "Captured deposit hold" : "Released deposit hold",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: {
        transactionId: transaction.id,
        depositAuthorizationId: depositAuth.id,
        action,
        captureType: action === "capture" ? (actualAmount === depositAuth.amount ? "full" : "partial") : null,
        releaseReason: action === "release" ? "manual_release" : null,
        authorizedAmount: depositAuth.amount,
        processedAmount: actualAmount,
        currency: depositAuth.currency,
        stripeIntentId: depositAuth.stripeIntentId,
        stripeFeeAmount: feeBreakdown?.stripeFeeAmount ?? null,
        platformFeeAmount: feeBreakdown?.platformFeeAmount ?? null,
        vendorNetAmount: feeBreakdown?.vendorNetAmount ?? null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Deposit Action Error:", error)
    return NextResponse.json({ success: false, message: "Failed to process deposit action" }, { status: 500 })
  }
}
