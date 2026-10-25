import type { AuditActorType, DepositAuthorization, Prisma, PrismaClient, Transaction, VendorProfile, ClientProfile } from "@prisma/client"

import {
  calculateCapturedDepositFeeBreakdown,
  recordDepositOutcome,
  recordFinanceAuditLog,
  type DepositOutcomeReason,
} from "@/features/transactions/server/transaction-finance"
import { sendVendorFeeReceiptEmail } from "@/lib/integrations/resend"
import type { StripeGateway } from "@/lib/integrations/stripe-gateway"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

export class DepositSettlementError extends Error {
  constructor(
    readonly code: "not_found" | "not_active" | "missing_intent" | "invalid_amount" | "not_connected",
    message: string
  ) {
    super(message)
  }
}

export type DepositSettlementActor = {
  id: string | null
  type: AuditActorType
  /** Who acted, for the audit log when there is no user (e.g. a partner API key prefix). */
  via?: string | null
}

type SettlementTransaction = Transaction & {
  depositAuthorization: DepositAuthorization | null
  vendor: VendorProfile | null
  clientProfile: ClientProfile | null
}

/**
 * Captures (fully or partly) or releases a booking's deposit at Stripe, then
 * records the outcome (timeline event + partner webhook, ledger, customer and
 * vendor e-mails) and the audit log. Shared by the vendor dashboard and the
 * partner API (pickup hold, C5b), so both settle a deposit exactly the same way.
 *
 * AUTHORIZATION_HOLD: capture ≤ the authorized amount (platform fee taken on
 * capture), or cancel the hold. CHARGE_REFUND: the money was charged up front,
 * so "capture" keeps it and "release" refunds it.
 */
export async function settleDepositHold(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: {
    transaction: SettlementTransaction
    action: "capture" | "release"
    captureAmount?: number | null
    reason?: DepositOutcomeReason
    actor: DepositSettlementActor
  }
) {
  const { transaction, action } = input
  const depositAuth = transaction.depositAuthorization

  if (!depositAuth) {
    throw new DepositSettlementError("not_found", "Transaction or deposit not found")
  }

  if (depositAuth.status !== "AUTHORIZED" && depositAuth.status !== "SUCCEEDED") {
    throw new DepositSettlementError("not_active", "Deposit is not in an active state")
  }

  if (!depositAuth.stripeIntentId) {
    throw new DepositSettlementError("missing_intent", "Missing Stripe Payment Intent")
  }

  const account = transaction.vendor?.stripeAccountId

  if (!account) {
    throw new DepositSettlementError("not_connected", "The vendor has no connected Stripe account")
  }

  const isChargeRefund = depositAuth.depositStrategy === "CHARGE_REFUND"
  const partialCents = action === "capture" && !isChargeRefund && input.captureAmount ? Math.round(input.captureAmount) : undefined

  if (partialCents !== undefined && (partialCents <= 0 || partialCents > depositAuth.amount)) {
    throw new DepositSettlementError("invalid_amount", "Invalid capture amount")
  }

  const call = { account }
  let feeBreakdown: ReturnType<typeof calculateCapturedDepositFeeBreakdown> | null = null

  if (action === "release") {
    if (isChargeRefund) {
      // The application fee stays as the vendor's accepted long-deposit platform cost.
      const refund = await gateway.payments.createRefund(
        { payment_intent: depositAuth.stripeIntentId, reason: "requested_by_customer" },
        { ...call, idempotencyKey: `deposit-refund:${depositAuth.id}` }
      )

      await db.depositAuthorization.update({
        where: { id: depositAuth.id },
        data: { status: "RELEASED", releasedAt: new Date(), depositRefundedAt: new Date(), depositRefundId: refund.id, depositRefundedAmount: refund.amount },
      })
    } else {
      await gateway.payments.cancelPaymentIntent(depositAuth.stripeIntentId, call)
      await db.depositAuthorization.update({ where: { id: depositAuth.id }, data: { status: "RELEASED", releasedAt: new Date() } })
    }
  } else if (isChargeRefund) {
    // Money already captured at Stripe (platform fee collected then): just mark it kept.
    feeBreakdown = calculateCapturedDepositFeeBreakdown(depositAuth.amount)
    await db.depositAuthorization.update({
      where: { id: depositAuth.id },
      data: { status: "CAPTURED", capturedAt: new Date(), depositCapturedAmount: depositAuth.amount },
    })
  } else {
    const capturedAmount = partialCents ?? depositAuth.amount
    feeBreakdown = calculateCapturedDepositFeeBreakdown(capturedAmount)

    await gateway.payments.capturePaymentIntent(
      depositAuth.stripeIntentId,
      { ...(partialCents ? { amount_to_capture: partialCents } : {}), application_fee_amount: feeBreakdown.platformFeeAmount },
      // A double click re-sends the same key: one capture at Stripe.
      { ...call, idempotencyKey: `deposit-capture:${depositAuth.id}` }
    )
    await db.depositAuthorization.update({
      where: { id: depositAuth.id },
      data: { status: "CAPTURED", capturedAt: new Date(), depositCapturedAmount: capturedAmount },
    })
  }

  const actualAmount = action === "capture" && partialCents ? partialCents : depositAuth.amount

  await recordDepositOutcome(db, {
    transactionId: transaction.id,
    amount: depositAuth.amount,
    actualAmount,
    currency: depositAuth.currency,
    stripeIntentId: depositAuth.stripeIntentId,
    action,
    reason: input.reason ?? (action === "capture" ? "manual_capture" : "manual_release"),
    vendorBusinessEmail: transaction.vendor?.businessEmail,
    vendorBusinessName: transaction.vendor?.businessName,
    clientFullName: transaction.clientProfile?.fullName,
    clientEmail: transaction.clientProfile?.email,
    locale: transaction.locale,
    vendorLocale: transaction.vendor?.preferredLocale,
    vendorLogoUrl: transaction.vendor?.businessLogoUrl,
  })

  await recordFinanceAuditLog(db, {
    actorId: input.actor.id,
    actorType: input.actor.type,
    action:
      action === "capture"
        ? isChargeRefund
          ? "Kept charge-and-refund deposit (no refund)"
          : "Captured deposit hold"
        : isChargeRefund
          ? "Refunded charge-and-refund deposit"
          : "Released deposit hold",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: {
      transactionId: transaction.id,
      depositAuthorizationId: depositAuth.id,
      depositStrategy: depositAuth.depositStrategy,
      action,
      captureType: action === "capture" ? (actualAmount === depositAuth.amount ? "full" : "partial") : null,
      releaseReason: action === "release" ? (input.reason ?? "manual_release") : null,
      authorizedAmount: depositAuth.amount,
      processedAmount: actualAmount,
      currency: depositAuth.currency,
      stripeIntentId: depositAuth.stripeIntentId,
      stripeFeeAmount: feeBreakdown?.stripeFeeAmount ?? null,
      platformFeeAmount: feeBreakdown?.platformFeeAmount ?? null,
      vendorNetAmount: feeBreakdown?.vendorNetAmount ?? null,
      via: input.actor.via ?? null,
    },
  })

  // Fee receipt to the vendor on capture (the fee is charged on capture).
  if (action === "capture" && feeBreakdown && transaction.vendor?.businessEmail) {
    sendVendorFeeReceiptEmail(
      transaction.vendor.businessEmail,
      transaction.vendor.businessName ?? "",
      transaction.reference,
      "deposit_capture",
      actualAmount,
      feeBreakdown.stripeFeeAmount,
      feeBreakdown.platformFeeAmount,
      depositAuth.currency,
      transaction.vendor.preferredLocale ?? transaction.locale ?? undefined
    ).catch(() => {})
  }

  return { actualAmount, feeBreakdown }
}
