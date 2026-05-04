import "server-only"

import {
  Prisma,
  SubscriptionBillingInterval,
  SubscriptionPlanKey,
  VendorSubscriptionStatus,
  type VendorProfile,
  type VendorSubscription,
} from "@prisma/client"
import type Stripe from "stripe"

import { hasActiveSubscription } from "@/features/subscriptions/server/feature-gates"
import { ensureUsageWindow } from "@/features/subscriptions/server/subscription-usage"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

export type VendorSubscriptionAccessState =
  | {
      allowed: true
      reason: "active"
      subscription: VendorSubscription
    }
  | {
      allowed: false
      reason: "missing" | "inactive"
      subscription: VendorSubscription | null
    }

function toDate(unixSeconds: number | null | undefined) {
  if (!unixSeconds) {
    return null
  }

  return new Date(unixSeconds * 1000)
}

export function toSubscriptionPlanKey(value: string | null | undefined) {
  if (!value) {
    return null
  }

  switch (value.trim().toLowerCase()) {
    case "starter":
      return SubscriptionPlanKey.STARTER
    case "pro":
      return SubscriptionPlanKey.PRO
    case "business":
      return SubscriptionPlanKey.BUSINESS
    case "enterprise":
      return SubscriptionPlanKey.ENTERPRISE
    default:
      return null
  }
}

export function toSubscriptionBillingInterval(value: string | null | undefined) {
  if (!value) {
    return null
  }

  switch (value.trim().toLowerCase()) {
    case "monthly":
    case "month":
      return SubscriptionBillingInterval.MONTHLY
    case "yearly":
    case "year":
      return SubscriptionBillingInterval.YEARLY
    default:
      return null
  }
}

export function normalizeStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "trialing":
      return VendorSubscriptionStatus.TRIALING
    case "active":
      return VendorSubscriptionStatus.ACTIVE
    case "past_due":
      return VendorSubscriptionStatus.PAST_DUE
    case "canceled":
      return VendorSubscriptionStatus.CANCELED
    case "incomplete":
      return VendorSubscriptionStatus.INCOMPLETE
    case "incomplete_expired":
      return VendorSubscriptionStatus.INCOMPLETE_EXPIRED
    case "unpaid":
      return VendorSubscriptionStatus.UNPAID
    default:
      return VendorSubscriptionStatus.INCOMPLETE
  }
}

export async function getVendorSubscriptionAccessState(vendorId: string): Promise<VendorSubscriptionAccessState> {
  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId },
  })

  if (!subscription) {
    return {
      allowed: false,
      reason: "missing",
      subscription: null,
    }
  }

  if (!hasActiveSubscription(subscription)) {
    return {
      allowed: false,
      reason: "inactive",
      subscription,
    }
  }

  return {
    allowed: true,
    reason: "active",
    subscription,
  }
}

export async function getOrCreateSubscriptionCustomer(
  input: {
    vendorProfile: Pick<VendorProfile, "id" | "businessName" | "businessEmail">
    user: { id: string; email: string; name?: string | null }
  }
) {
  const existing = await prisma.vendorSubscription.findUnique({
    where: { vendorId: input.vendorProfile.id },
  })

  if (existing?.stripeCustomerId) {
    return {
      customerId: existing.stripeCustomerId,
      subscription: existing,
    }
  }

  const customer = await stripe.customers.create({
    email: input.vendorProfile.businessEmail || input.user.email,
    name: input.vendorProfile.businessName || input.user.name || input.user.email,
    metadata: {
      vendorId: input.vendorProfile.id,
      userId: input.user.id,
    },
  })

  const subscription = existing
    ? await prisma.vendorSubscription.update({
        where: { id: existing.id },
        data: {
          stripeCustomerId: customer.id,
        },
      })
    : await prisma.vendorSubscription.create({
        data: {
          vendorId: input.vendorProfile.id,
          planKey: SubscriptionPlanKey.STARTER,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
          status: VendorSubscriptionStatus.INCOMPLETE,
          stripeCustomerId: customer.id,
        },
      })

  return {
    customerId: customer.id,
    subscription,
  }
}

async function resolveVendorIdForStripeObject(input: {
  metadataVendorId?: string | null
  stripeSubscriptionId?: string | null
  stripeCustomerId?: string | null
}) {
  if (input.metadataVendorId) {
    return input.metadataVendorId
  }

  const orConditions = [
    input.stripeSubscriptionId ? { stripeSubscriptionId: input.stripeSubscriptionId } : null,
    input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : null,
  ].filter(Boolean) as Prisma.VendorSubscriptionWhereInput[]

  if (orConditions.length === 0) {
    return null
  }

  const existing = await prisma.vendorSubscription.findFirst({
    where: {
      OR: orConditions,
    },
    select: { vendorId: true },
  })

  return existing?.vendorId ?? null
}

export async function upsertVendorSubscriptionFromStripeSubscription(
  stripeSubscription: Stripe.Subscription,
  vendorIdOverride?: string | null
) {
  const vendorId =
    vendorIdOverride ??
    (await resolveVendorIdForStripeObject({
      metadataVendorId: stripeSubscription.metadata.vendorId,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId:
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer?.id,
    }))

  if (!vendorId) {
    throw new Error(`Unable to resolve vendor for Stripe subscription ${stripeSubscription.id}`)
  }

  const planKey =
    toSubscriptionPlanKey(stripeSubscription.metadata.planKey) ??
    toSubscriptionPlanKey(stripeSubscription.items.data[0]?.price.metadata.planKey) ??
    SubscriptionPlanKey.STARTER
  const billingInterval =
    toSubscriptionBillingInterval(stripeSubscription.metadata.billingInterval) ??
    toSubscriptionBillingInterval(stripeSubscription.items.data[0]?.price.recurring?.interval) ??
    SubscriptionBillingInterval.MONTHLY
  const stripePriceId = stripeSubscription.items.data[0]?.price.id ?? null
  const stripeProductId =
    typeof stripeSubscription.items.data[0]?.price.product === "string"
      ? stripeSubscription.items.data[0]?.price.product
      : stripeSubscription.items.data[0]?.price.product?.id ?? null
  const currentPeriodStart = toDate(stripeSubscription.items.data[0]?.current_period_start)
  const currentPeriodEnd = toDate(stripeSubscription.items.data[0]?.current_period_end)
  const stripeCustomerId =
    typeof stripeSubscription.customer === "string"
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id ?? null

  const subscription = await prisma.vendorSubscription.upsert({
    where: { vendorId },
    create: {
      vendorId,
      planKey,
      billingInterval,
      status: normalizeStripeSubscriptionStatus(stripeSubscription.status),
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId,
      stripeProductId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialStart: toDate(stripeSubscription.trial_start),
      trialEnd: toDate(stripeSubscription.trial_end),
      usagePeriodStart: currentPeriodStart,
      usagePeriodEnd: currentPeriodEnd,
    },
    update: {
      planKey,
      billingInterval,
      status: normalizeStripeSubscriptionStatus(stripeSubscription.status),
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId,
      stripeProductId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialStart: toDate(stripeSubscription.trial_start),
      trialEnd: toDate(stripeSubscription.trial_end),
    },
  })

  await prisma.$transaction(async (tx) => {
    await ensureUsageWindow(tx, subscription, currentPeriodStart, currentPeriodEnd)
  })

  return prisma.vendorSubscription.findUniqueOrThrow({
    where: { vendorId },
  })
}

export async function syncVendorSubscriptionByStripeId(stripeSubscriptionId: string, vendorIdOverride?: string | null) {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["items.data.price.product"],
  })

  return upsertVendorSubscriptionFromStripeSubscription(subscription, vendorIdOverride)
}
