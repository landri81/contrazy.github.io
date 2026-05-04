import "server-only"

import { SubscriptionBillingInterval, SubscriptionPlanKey } from "@prisma/client"

import { env } from "@/lib/env"

export function getSubscriptionPlanPriceId(
  planKey: SubscriptionPlanKey,
  billingInterval: SubscriptionBillingInterval
) {
  const priceId = (() => {
    switch (planKey) {
      case SubscriptionPlanKey.STARTER:
        return billingInterval === SubscriptionBillingInterval.MONTHLY
          ? env.STRIPE_PRICE_STARTER_MONTHLY
          : env.STRIPE_PRICE_STARTER_YEARLY
      case SubscriptionPlanKey.PRO:
        return billingInterval === SubscriptionBillingInterval.MONTHLY
          ? env.STRIPE_PRICE_PRO_MONTHLY
          : env.STRIPE_PRICE_PRO_YEARLY
      case SubscriptionPlanKey.BUSINESS:
        return billingInterval === SubscriptionBillingInterval.MONTHLY
          ? env.STRIPE_PRICE_BUSINESS_MONTHLY
          : env.STRIPE_PRICE_BUSINESS_YEARLY
      case SubscriptionPlanKey.ENTERPRISE:
        return null
      default:
        return null
    }
  })()

  if (!priceId) {
    throw new Error(`Missing Stripe price ID for ${planKey} ${billingInterval}`)
  }

  return priceId
}

export function getSubscriptionTrialDays(planKey: SubscriptionPlanKey) {
  if (planKey === SubscriptionPlanKey.PRO) {
    return env.STRIPE_PRO_TRIAL_DAYS
  }

  if (planKey === SubscriptionPlanKey.BUSINESS) {
    return env.STRIPE_BUSINESS_TRIAL_DAYS
  }

  return 0
}
