import "server-only"

import { DepositStrategy, SubscriptionPlanKey, type VendorSubscription } from "@prisma/client"

import { hasActiveSubscription } from "./feature-gates"

export function getDepositStrategy(
  subscription: VendorSubscription | null | undefined
): DepositStrategy {
  if (!hasActiveSubscription(subscription) || !subscription) {
    return DepositStrategy.AUTHORIZATION_HOLD
  }
  switch (subscription.planKey) {
    case SubscriptionPlanKey.STARTER:
      return DepositStrategy.AUTHORIZATION_HOLD
    case SubscriptionPlanKey.PRO:
    case SubscriptionPlanKey.BUSINESS:
    case SubscriptionPlanKey.ENTERPRISE:
      return DepositStrategy.CHARGE_REFUND
    default:
      return DepositStrategy.AUTHORIZATION_HOLD
  }
}

export function getDepositAutoRefundDays(
  subscription: VendorSubscription | null | undefined
): number {
  if (!hasActiveSubscription(subscription) || !subscription) return 7
  switch (subscription.planKey) {
    case SubscriptionPlanKey.STARTER:
      return 7
    case SubscriptionPlanKey.PRO:
      return 14
    case SubscriptionPlanKey.BUSINESS:
    case SubscriptionPlanKey.ENTERPRISE:
      return 30
    default:
      return 7
  }
}
