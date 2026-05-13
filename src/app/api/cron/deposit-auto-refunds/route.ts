import { NextResponse } from "next/server"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import {
  recordDepositOutcome,
} from "@/features/transactions/server/transaction-finance"
import { prisma } from "@/lib/db/prisma"
import { env } from "@/lib/env"
import { getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  const deposits = await prisma.depositAuthorization.findMany({
    where: {
      depositStrategy: "CHARGE_REFUND",
      status: "SUCCEEDED",
      depositAutoRefundAt: { lte: now },
      depositRefundedAt: null,
      transaction: { status: { not: "DISPUTED" } },
    },
    include: {
      transaction: {
        include: {
          vendor: true,
          clientProfile: true,
        },
      },
    },
    take: 50,
    orderBy: { depositAutoRefundAt: "asc" },
  })

  const results = { processed: 0, skipped: 0, failed: 0 }

  for (const deposit of deposits) {
    if (!deposit.stripeIntentId) {
      results.skipped++
      continue
    }

    const stripeOpts = getConnectedAccountRequestOptions(
      deposit.transaction.vendor?.stripeAccountId
    )

    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: deposit.stripeIntentId,
          reason: "requested_by_customer",
          refund_application_fee: true,
        },
        stripeOpts
      )

      await prisma.$transaction(async (tx) => {
        await tx.depositAuthorization.update({
          where: { id: deposit.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            depositRefundedAt: new Date(),
            depositRefundId: refund.id,
            depositRefundedAmount: refund.amount,
          },
        })

        await recordTransactionEvent(tx, {
          transactionId: deposit.transactionId,
          type: "DEPOSIT_AUTO_REFUNDED",
          title: "Deposit auto-refunded",
          detail: `${deposit.currency} ${(deposit.amount / 100).toFixed(2)} automatically refunded after deposit period ended.`,
          dedupeKey: `event:deposit-auto-refunded:${deposit.transactionId}:${deposit.stripeIntentId}`,
          metadata: {
            refundId: refund.id,
            refundAmount: refund.amount,
            depositStrategy: "CHARGE_REFUND",
            depositAutoRefundAt: deposit.depositAutoRefundAt?.toISOString() ?? null,
          },
        })
      })

      await recordDepositOutcome(prisma, {
        transactionId: deposit.transactionId,
        amount: deposit.amount,
        actualAmount: refund.amount,
        currency: deposit.currency,
        stripeIntentId: deposit.stripeIntentId,
        action: "release",
        reason: "manual_release",
        vendorBusinessEmail: deposit.transaction.vendor?.businessEmail,
        vendorBusinessName: deposit.transaction.vendor?.businessName,
        clientFullName: deposit.transaction.clientProfile?.fullName,
        clientEmail: deposit.transaction.clientProfile?.email,
        locale: deposit.transaction.locale,
      })

      results.processed++
    } catch (error) {
      console.error(`Failed to auto-refund deposit ${deposit.id}:`, error)

      await recordTransactionEvent(prisma, {
        transactionId: deposit.transactionId,
        type: "DEPOSIT_REFUND_FAILED",
        title: "Deposit auto-refund failed",
        detail: `Auto-refund attempt failed for deposit ${deposit.id}.`,
        metadata: {
          depositId: deposit.id,
          stripeIntentId: deposit.stripeIntentId,
          error: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => {})

      results.failed++
    }
  }

  return NextResponse.json({ ok: true, ...results, total: deposits.length })
}
