import { SubscriptionBillingInterval, SubscriptionPlanKey, VendorSubscriptionStatus, type VendorSubscription } from "@prisma/client"

import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

/**
 * Partner plan: an Enterprise subscription with no Stripe billing and no end date, that only a super admin grants or
 * withdraws (LYNAEL's own brands, such as LOCAZ). Enterprise has no usage limit, so every plan gate lets it through.
 */
export const PARTNER_PLAN_KEY = SubscriptionPlanKey.ENTERPRISE

/** Stripe statuses that would still bill the vendor next to the free plan. */
const BILLING_STATUSES = new Set<VendorSubscriptionStatus>([VendorSubscriptionStatus.TRIALING, VendorSubscriptionStatus.ACTIVE, VendorSubscriptionStatus.PAST_DUE, VendorSubscriptionStatus.INCOMPLETE, VendorSubscriptionStatus.UNPAID])

export function isPartnerPlanActive(subscription: Pick<VendorSubscription, "partnerPlan" | "status"> | null | undefined) {
  return Boolean(subscription?.partnerPlan && subscription.status === VendorSubscriptionStatus.ACTIVE)
}

type Actor = { id: string; email: string }

export class PartnerPlanError extends Error {
  constructor(public readonly code: "vendor_not_found" | "not_on_partner_plan" | "stripe_cancel_failed", message: string) {
    super(message)
    this.name = "PartnerPlanError"
  }
}

/** Grants the partner plan. A Stripe subscription still running is cancelled first, so the vendor is never billed. */
export async function grantPartnerPlan(vendorId: string, actor: Actor, note?: string | null) {
  const vendor = await prisma.vendorProfile.findUnique({ where: { id: vendorId }, select: { id: true, subscription: true } })
  if (!vendor) throw new PartnerPlanError("vendor_not_found", "Vendor account not found.")

  const current = vendor.subscription
  let cancelledStripeSubscriptionId: string | null = null
  if (current?.stripeSubscriptionId && BILLING_STATUSES.has(current.status)) {
    try {
      await stripe.subscriptions.cancel(current.stripeSubscriptionId)
      cancelledStripeSubscriptionId = current.stripeSubscriptionId
    } catch (error) {
      console.error("Partner plan: the Stripe subscription could not be cancelled", error)
      throw new PartnerPlanError("stripe_cancel_failed", "The vendor's Stripe subscription could not be cancelled. Try again, or cancel it in Stripe first.")
    }
  }

  const now = new Date()
  const plan = {
    planKey: PARTNER_PLAN_KEY,
    status: VendorSubscriptionStatus.ACTIVE,
    stripeSubscriptionId: null,
    stripePriceId: null,
    stripeProductId: null,
    currentPeriodStart: now,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialStart: null,
    trialEnd: null,
    usagePeriodStart: now,
    usagePeriodEnd: null,
    partnerPlan: true,
    partnerGrantedAt: now,
    partnerGrantedBy: actor.email,
    partnerNote: note?.trim() || null,
  }

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.vendorSubscription.upsert({
      where: { vendorId },
      create: { vendorId, billingInterval: SubscriptionBillingInterval.MONTHLY, ...plan },
      update: plan,
    })
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "vendor_subscription.partner_plan_granted",
        entityType: "VendorSubscription",
        entityId: subscription.id,
        metadata: { vendorId, note: plan.partnerNote, previousPlan: current?.planKey ?? null, previousStatus: current?.status ?? null, cancelledStripeSubscriptionId },
      },
    })
    return subscription
  })
}

/** Withdraws the partner plan: the subscription ends now and the vendor sees the plans to subscribe again. */
export async function revokePartnerPlan(vendorId: string, actor: Actor) {
  const current = await prisma.vendorSubscription.findUnique({ where: { vendorId } })
  if (!current || !isPartnerPlanActive(current)) throw new PartnerPlanError("not_on_partner_plan", "This vendor is not on the partner plan.")

  return prisma.$transaction(async (tx) => {
    const subscription = await tx.vendorSubscription.update({
      where: { vendorId },
      data: { status: VendorSubscriptionStatus.CANCELED, currentPeriodEnd: new Date(), partnerPlan: false },
    })
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "vendor_subscription.partner_plan_revoked", entityType: "VendorSubscription", entityId: subscription.id, metadata: { vendorId } },
    })
    return subscription
  })
}
