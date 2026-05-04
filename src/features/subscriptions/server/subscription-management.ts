import "server-only"

import {
  SubscriptionBillingInterval,
  SubscriptionPlanKey,
  VendorSubscriptionStatus,
  type VendorSubscription,
} from "@prisma/client"
import type Stripe from "stripe"

import { subscriptionPlanMap, type SubscriptionBillingIntervalSlug, type SubscriptionPlanSlug } from "@/features/subscriptions/config"
import {
  canUseKyc,
  getContractTemplateLimit,
  getESignatureLimit,
  getKycLimit,
  getQrCodeLimit,
  getTransactionLimit,
  hasActiveSubscription,
  maxTeamUsers,
  remainingESignatures,
  remainingKycVerifications,
  remainingQrCodes,
  remainingTransactions,
} from "@/features/subscriptions/server/feature-gates"
import { getSubscriptionPlanPriceId } from "@/features/subscriptions/server/subscription-billing"
import {
  toSubscriptionBillingInterval,
  toSubscriptionPlanKey,
  upsertVendorSubscriptionFromStripeSubscription,
} from "@/features/subscriptions/server/subscription-service"
import type {
  BillingAccessInfo,
  BillingInvoice,
  BillingPaymentMethod,
  BillingUsage,
  BillingWorkspace,
  ChangePlanResult,
  SerializedSubscription,
} from "@/features/subscriptions/types"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

// ── Status sets ───────────────────────────────────────────────────────────────

export const RECOVERY_STATUSES = new Set<VendorSubscriptionStatus>([
  VendorSubscriptionStatus.PAST_DUE,
  VendorSubscriptionStatus.UNPAID,
  VendorSubscriptionStatus.INCOMPLETE,
])

export const TERMINAL_STATUSES = new Set<VendorSubscriptionStatus>([
  VendorSubscriptionStatus.CANCELED,
  VendorSubscriptionStatus.INCOMPLETE_EXPIRED,
])

export type {
  BillingAccessInfo,
  BillingInvoice,
  BillingPaymentMethod,
  BillingUsage,
  BillingWorkspace,
  ChangePlanResult,
  SerializedSubscription,
} from "@/features/subscriptions/types"

// ── Serialization helpers ─────────────────────────────────────────────────────

function planKeyToSlug(planKey: SubscriptionPlanKey): SubscriptionPlanSlug {
  return planKey.toLowerCase() as SubscriptionPlanSlug
}

function intervalToSlug(billingInterval: SubscriptionBillingInterval): SubscriptionBillingIntervalSlug {
  return billingInterval.toLowerCase() as SubscriptionBillingIntervalSlug
}

function serializeSubscription(sub: VendorSubscription): SerializedSubscription {
  return {
    id: sub.id,
    planKey: sub.planKey,
    planSlug: planKeyToSlug(sub.planKey),
    billingInterval: sub.billingInterval,
    intervalSlug: intervalToSlug(sub.billingInterval),
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialStart: sub.trialStart?.toISOString() ?? null,
    trialEnd: sub.trialEnd?.toISOString() ?? null,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    stripeCustomerId: sub.stripeCustomerId,
  }
}

function serializeInvoice(inv: Stripe.Invoice): BillingInvoice {
  const lines = inv.lines?.data
  const firstLine = lines?.[0]
  return {
    id: inv.id ?? "",
    number: inv.number ?? null,
    status: inv.status ?? "unknown",
    amountDue: inv.amount_due,
    amountPaid: inv.amount_paid,
    currency: inv.currency,
    created: inv.created,
    periodStart: firstLine?.period?.start ?? null,
    periodEnd: firstLine?.period?.end ?? null,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdf: inv.invoice_pdf ?? null,
  }
}

// ── Payment method helpers ────────────────────────────────────────────────────

async function resolveDefaultPaymentMethodId(
  stripeCustomerId: string,
  stripeSubscriptionId: string | null
): Promise<string | null> {
  try {
    if (stripeSubscriptionId) {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ["default_payment_method"],
      })
      if (stripeSub.default_payment_method && typeof stripeSub.default_payment_method === "object") {
        return (stripeSub.default_payment_method as Stripe.PaymentMethod).id
      }
    }
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    })
    if (!("deleted" in customer) && customer.invoice_settings.default_payment_method &&
        typeof customer.invoice_settings.default_payment_method === "object") {
      return (customer.invoice_settings.default_payment_method as Stripe.PaymentMethod).id
    }
  } catch {
    // Non-blocking
  }
  return null
}

async function listAllPaymentMethods(
  stripeCustomerId: string,
  stripeSubscriptionId: string | null
): Promise<BillingPaymentMethod[]> {
  try {
    const [defaultPmId, list] = await Promise.all([
      resolveDefaultPaymentMethodId(stripeCustomerId, stripeSubscriptionId),
      stripe.paymentMethods.list({ customer: stripeCustomerId, type: "card", limit: 20 }),
    ])
    return list.data
      .filter((pm) => pm.card)
      .map((pm) => ({
        id: pm.id,
        brand: pm.card!.brand,
        last4: pm.card!.last4,
        expMonth: pm.card!.exp_month,
        expYear: pm.card!.exp_year,
        isDefault: pm.id === defaultPmId,
      }))
      .sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0))
  } catch {
    return []
  }
}

// ── getBillingWorkspace ───────────────────────────────────────────────────────

export async function getBillingWorkspace(vendorId: string): Promise<BillingWorkspace> {
  const subscription = await prisma.vendorSubscription.findUnique({ where: { vendorId } })

  const allowed = subscription ? hasActiveSubscription(subscription) : false
  const isRecovery = subscription ? RECOVERY_STATUSES.has(subscription.status) : false
  const canFresh = !subscription || TERMINAL_STATUSES.has(subscription.status)

  const access: BillingAccessInfo = {
    allowed,
    reason: !subscription ? "missing" : allowed ? "active" : "inactive",
    isRecoveryState: isRecovery,
    canStartFreshCheckout: canFresh,
  }

  const [contractTemplateCount, acceptedInvitationCount] = await Promise.all([
    prisma.contractTemplate.count({ where: { vendorId } }),
    prisma.invitation.count({ where: { vendorId, status: "ACCEPTED" } }),
  ])

  const usage: BillingUsage = {
    transactions: {
      used: subscription?.transactionsUsed ?? 0,
      limit: getTransactionLimit(subscription),
      remaining: remainingTransactions(subscription),
    },
    eSignatures: {
      used: subscription?.eSignaturesUsed ?? 0,
      limit: getESignatureLimit(subscription),
      remaining: remainingESignatures(subscription),
    },
    qrCodes: {
      used: subscription?.qrCodesUsed ?? 0,
      limit: getQrCodeLimit(subscription),
      remaining: remainingQrCodes(subscription),
    },
    contractTemplates: {
      used: contractTemplateCount,
      limit: getContractTemplateLimit(subscription),
    },
    kyc: {
      used: subscription?.kycVerificationsUsed ?? 0,
      limit: getKycLimit(subscription),
      remaining: remainingKycVerifications(subscription),
      allowed: canUseKyc(subscription),
    },
    teamUsers: {
      // 1 = vendor owner, plus accepted team invitees
      used: 1 + acceptedInvitationCount,
      limit: maxTeamUsers(subscription),
    },
    periodStart: subscription?.usagePeriodStart?.toISOString() ?? null,
    periodEnd: subscription?.usagePeriodEnd?.toISOString() ?? null,
  }

  const [paymentMethods, invoices] = subscription?.stripeCustomerId
    ? await Promise.all([
        listAllPaymentMethods(subscription.stripeCustomerId, subscription.stripeSubscriptionId),
        fetchInvoices(subscription.stripeCustomerId, 5),
      ])
    : [[], []]

  return {
    subscription: subscription ? serializeSubscription(subscription) : null,
    access,
    usage,
    paymentMethods,
    invoices,
  }
}

// ── fetchInvoices ─────────────────────────────────────────────────────────────

export async function fetchInvoices(stripeCustomerId: string, limit = 12): Promise<BillingInvoice[]> {
  try {
    const list = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit,
      expand: ["data.lines"],
    })
    return list.data.map(serializeInvoice)
  } catch {
    return []
  }
}

// ── changePlan ────────────────────────────────────────────────────────────────

export async function changePlan(
  vendorId: string,
  newPlanKey: SubscriptionPlanKey,
  newBillingInterval: SubscriptionBillingInterval
): Promise<ChangePlanResult> {
  const subscription = await prisma.vendorSubscription.findUnique({ where: { vendorId } })

  if (!subscription?.stripeSubscriptionId) {
    throw new Error("No Stripe subscription found")
  }

  if (RECOVERY_STATUSES.has(subscription.status)) {
    throw new Error("Resolve the payment issue on your billing page before changing plans.")
  }

  if (!hasActiveSubscription(subscription)) {
    throw new Error("Subscription is not active or trialing.")
  }

  if (newPlanKey === SubscriptionPlanKey.ENTERPRISE) {
    throw new Error("Enterprise plans are managed through sales.")
  }

  const newPlanSlug = planKeyToSlug(newPlanKey)
  const newIntervalSlug = intervalToSlug(newBillingInterval)
  const planDef = subscriptionPlanMap[newPlanSlug]

  if (!planDef) {
    throw new Error("Unknown plan.")
  }

  const newPriceId = getSubscriptionPlanPriceId(newPlanKey, newBillingInterval)

  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)
  const currentItemId = stripeSub.items.data[0]?.id

  if (!currentItemId) {
    throw new Error("Could not find subscription item.")
  }

  const intervalChanged = subscription.billingInterval !== newBillingInterval

  const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{ id: currentItemId, price: newPriceId }],
    proration_behavior: "always_invoice",
    ...(intervalChanged ? { billing_cycle_anchor: "now" } : {}),
    cancel_at_period_end: false,
    metadata: {
      ...stripeSub.metadata,
      planKey: newPlanSlug,
      billingInterval: newIntervalSlug,
    },
    expand: ["latest_invoice.payment_intent"],
  })

  await upsertVendorSubscriptionFromStripeSubscription(updated, vendorId)

  const invoice = updated.latest_invoice as Record<string, unknown> | string | null
  const piRaw = typeof invoice === "object" && invoice !== null ? invoice["payment_intent"] : null
  const pi = (typeof piRaw === "object" ? piRaw : null) as Stripe.PaymentIntent | null

  if (pi?.status === "requires_action" && pi.client_secret) {
    return { requiresAction: true, clientSecret: pi.client_secret }
  }

  return { requiresAction: false, clientSecret: null }
}

// ── cancelAtPeriodEnd ─────────────────────────────────────────────────────────

export async function cancelSubscriptionAtPeriodEnd(vendorId: string): Promise<SerializedSubscription> {
  const subscription = await prisma.vendorSubscription.findUnique({ where: { vendorId } })

  if (!subscription?.stripeSubscriptionId) {
    throw new Error("No active subscription found.")
  }

  if (!hasActiveSubscription(subscription)) {
    throw new Error("Subscription is not active or trialing.")
  }

  if (subscription.cancelAtPeriodEnd) {
    throw new Error("Subscription is already scheduled for cancellation.")
  }

  const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  })

  const synced = await upsertVendorSubscriptionFromStripeSubscription(updated, vendorId)
  return serializeSubscription(synced)
}

// ── reactivate ────────────────────────────────────────────────────────────────

export async function reactivateSubscription(vendorId: string): Promise<SerializedSubscription> {
  const subscription = await prisma.vendorSubscription.findUnique({ where: { vendorId } })

  if (!subscription?.stripeSubscriptionId) {
    throw new Error("No active subscription found.")
  }

  if (!hasActiveSubscription(subscription)) {
    throw new Error("Subscription period has already ended and cannot be reactivated.")
  }

  if (!subscription.cancelAtPeriodEnd) {
    throw new Error("Subscription is not scheduled for cancellation.")
  }

  const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: false,
  })

  const synced = await upsertVendorSubscriptionFromStripeSubscription(updated, vendorId)
  return serializeSubscription(synced)
}

// ── createSetupIntent ─────────────────────────────────────────────────────────

export async function createPaymentMethodSetupIntent(vendorId: string): Promise<string> {
  const subscription = await prisma.vendorSubscription.findUnique({ where: { vendorId } })

  if (!subscription?.stripeCustomerId) {
    throw new Error("No billing customer found.")
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: subscription.stripeCustomerId,
    usage: "off_session",
    payment_method_types: ["card"],
  })

  if (!setupIntent.client_secret) {
    throw new Error("Failed to create setup intent.")
  }

  return setupIntent.client_secret
}

// ── attachPaymentMethod ───────────────────────────────────────────────────────

export async function attachPaymentMethod(vendorId: string, paymentMethodId: string): Promise<void> {
  const subscription = await prisma.vendorSubscription.findUnique({ where: { vendorId } })

  if (!subscription?.stripeCustomerId) {
    throw new Error("No billing customer found.")
  }

  await stripe.paymentMethods.attach(paymentMethodId, {
    customer: subscription.stripeCustomerId,
  })

  await stripe.customers.update(subscription.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  if (subscription.stripeSubscriptionId) {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      default_payment_method: paymentMethodId,
    })
  }
}

// ── setDefaultPaymentMethod ───────────────────────────────────────────────────

export async function setDefaultPaymentMethod(vendorId: string, paymentMethodId: string): Promise<void> {
  const subscription = await prisma.vendorSubscription.findUnique({ where: { vendorId } })

  if (!subscription?.stripeCustomerId) {
    throw new Error("No billing customer found.")
  }

  await stripe.customers.update(subscription.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  if (subscription.stripeSubscriptionId) {
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      default_payment_method: paymentMethodId,
    })
  }
}

// ── deletePaymentMethod ───────────────────────────────────────────────────────

export async function deletePaymentMethod(vendorId: string, paymentMethodId: string): Promise<void> {
  const subscription = await prisma.vendorSubscription.findUnique({ where: { vendorId } })

  if (!subscription?.stripeCustomerId) {
    throw new Error("No billing customer found.")
  }

  const allMethods = await listAllPaymentMethods(subscription.stripeCustomerId, subscription.stripeSubscriptionId)

  const isActive = subscription ? hasActiveSubscription(subscription) : false
  const isRecovery = RECOVERY_STATUSES.has(subscription.status)

  if ((isActive || isRecovery) && allMethods.length <= 1) {
    throw new Error("You must keep at least one payment method while your subscription is active.")
  }

  await stripe.paymentMethods.detach(paymentMethodId)

  // If the deleted card was the default, promote the next available card
  const wasDefault = allMethods.find((pm) => pm.id === paymentMethodId)?.isDefault
  if (wasDefault) {
    const next = allMethods.find((pm) => pm.id !== paymentMethodId)
    if (next && subscription.stripeSubscriptionId) {
      await stripe.customers.update(subscription.stripeCustomerId, {
        invoice_settings: { default_payment_method: next.id },
      })
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        default_payment_method: next.id,
      })
    }
  }
}

// ── Checkout eligibility helper (used by checkout route) ─────────────────────

export function resolveCheckoutEligibility(subscription: VendorSubscription | null) {
  if (!subscription) {
    return { eligible: true, reason: null }
  }

  if (hasActiveSubscription(subscription)) {
    return { eligible: false, reason: "already_active" as const }
  }

  if (RECOVERY_STATUSES.has(subscription.status)) {
    return { eligible: false, reason: "recovery_required" as const }
  }

  if (TERMINAL_STATUSES.has(subscription.status)) {
    return { eligible: true, reason: null }
  }

  return { eligible: false, reason: "already_active" as const }
}

// ── Plan helpers (used by billing UI) ────────────────────────────────────────

export function planSlugFromKey(planKey: SubscriptionPlanKey): SubscriptionPlanSlug {
  return planKey.toLowerCase() as SubscriptionPlanSlug
}

export function intervalSlugFromEnum(billingInterval: SubscriptionBillingInterval): SubscriptionBillingIntervalSlug {
  return billingInterval.toLowerCase() as SubscriptionBillingIntervalSlug
}

export { toSubscriptionBillingInterval, toSubscriptionPlanKey }
