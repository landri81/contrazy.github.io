import "server-only"

import { DepositStrategy, SubscriptionPlanKey, type VendorSubscription } from "@prisma/client"

import { hasActiveSubscription } from "./feature-gates"

export const FREE_DEPOSIT_HOLD_DAYS = 7
export const MAX_LONG_DEPOSIT_HOLD_DAYS = 30
export const LONG_DEPOSIT_PLATFORM_FEE_RATE = 0.005
export const STRIPE_PROCESSING_FEE_RATE_ESTIMATE = 0.015
export const STRIPE_PROCESSING_FIXED_FEE_ESTIMATE = 25

export function canChooseLongDeposit(subscription: VendorSubscription | null | undefined) {
  return Boolean(
    hasActiveSubscription(subscription) &&
      subscription &&
      subscription.planKey !== SubscriptionPlanKey.STARTER
  )
}

export function normalizeDepositHoldDays(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return FREE_DEPOSIT_HOLD_DAYS
  }

  return Math.trunc(value)
}

export function getDepositStrategy(
  subscription: VendorSubscription | null | undefined,
  depositHoldDays: number | null | undefined = FREE_DEPOSIT_HOLD_DAYS
): DepositStrategy {
  const normalizedDays = normalizeDepositHoldDays(depositHoldDays)

  if (normalizedDays > FREE_DEPOSIT_HOLD_DAYS && canChooseLongDeposit(subscription)) {
    return DepositStrategy.CHARGE_REFUND
  }

  return DepositStrategy.AUTHORIZATION_HOLD
}

export function getDepositAutoRefundDays(
  _subscription: VendorSubscription | null | undefined,
  depositHoldDays: number | null | undefined = FREE_DEPOSIT_HOLD_DAYS
): number {
  return normalizeDepositHoldDays(depositHoldDays)
}

export function estimateLongDepositVendorFee(amountCents: number) {
  const stripeFeeAmount =
    Math.round(amountCents * STRIPE_PROCESSING_FEE_RATE_ESTIMATE) +
    STRIPE_PROCESSING_FIXED_FEE_ESTIMATE
  const platformFeeAmount = Math.round(amountCents * LONG_DEPOSIT_PLATFORM_FEE_RATE)

  return {
    stripeFeeAmount,
    platformFeeAmount,
    totalFeeAmount: stripeFeeAmount + platformFeeAmount,
  }
}
