import "server-only"

import {
  SubscriptionPlanKey,
  VendorSubscriptionStatus,
  type VendorSubscription,
} from "@prisma/client"

const ACTIVE_STATUSES = new Set<VendorSubscriptionStatus>([
  VendorSubscriptionStatus.ACTIVE,
  VendorSubscriptionStatus.TRIALING,
])

export function hasActiveSubscription(subscription: VendorSubscription | null | undefined) {
  if (!subscription) {
    return false
  }

  if (!ACTIVE_STATUSES.has(subscription.status)) {
    return false
  }

  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= Date.now()) {
    return false
  }

  return true
}

// ── Transactions ──────────────────────────────────────────────────────────────

export function getTransactionLimit(subscription: VendorSubscription | null | undefined) {
  if (!subscription) return 0
  if (subscription.planKey === SubscriptionPlanKey.STARTER) return 10
  return null
}

export function remainingTransactions(subscription: VendorSubscription | null | undefined) {
  const limit = getTransactionLimit(subscription)
  if (limit === null) return null
  return Math.max(limit - (subscription?.transactionsUsed ?? 0), 0)
}

// ── E-Signatures ──────────────────────────────────────────────────────────────

export function getESignatureLimit(subscription: VendorSubscription | null | undefined) {
  if (!subscription) return 0
  switch (subscription.planKey) {
    case SubscriptionPlanKey.STARTER: return 10
    case SubscriptionPlanKey.PRO:
    case SubscriptionPlanKey.BUSINESS:
    case SubscriptionPlanKey.ENTERPRISE: return null
    default: return 0
  }
}

export function remainingESignatures(subscription: VendorSubscription | null | undefined) {
  const limit = getESignatureLimit(subscription)
  if (limit === null) return null
  return Math.max(limit - (subscription?.eSignaturesUsed ?? 0), 0)
}

// ── QR Codes (per billing period) ────────────────────────────────────────────

export function getQrCodeLimit(subscription: VendorSubscription | null | undefined) {
  if (!subscription) return 0
  if (subscription.planKey === SubscriptionPlanKey.STARTER) return 2
  return null
}

export function remainingQrCodes(subscription: VendorSubscription | null | undefined) {
  const limit = getQrCodeLimit(subscription)
  if (limit === null) return null
  return Math.max(limit - (subscription?.qrCodesUsed ?? 0), 0)
}

// ── Contract Templates (lifetime count, not monthly) ─────────────────────────

export function getContractTemplateLimit(subscription: VendorSubscription | null | undefined) {
  if (!subscription) return 0
  if (subscription.planKey === SubscriptionPlanKey.STARTER) return 1
  return null
}

// ── KYC Verifications ────────────────────────────────────────────────────────

export function canUseKyc(subscription: VendorSubscription | null | undefined) {
  if (!hasActiveSubscription(subscription)) return false
  if (!subscription) return false
  // Starter plan does not include KYC
  return subscription.planKey !== SubscriptionPlanKey.STARTER
}

export function getKycProvider(subscription: VendorSubscription | null | undefined): "manual" | "stripe_identity" {
  if (!subscription) return "manual"
  if (subscription.planKey === SubscriptionPlanKey.STARTER) return "manual"
  return "stripe_identity"
}

export function getKycLimit(subscription: VendorSubscription | null | undefined) {
  if (!subscription) return 0
  switch (subscription.planKey) {
    case SubscriptionPlanKey.STARTER: return 0  // not included
    case SubscriptionPlanKey.PRO: return 10
    case SubscriptionPlanKey.BUSINESS: return 25
    case SubscriptionPlanKey.ENTERPRISE: return null
    default: return 0
  }
}

export function remainingKycVerifications(subscription: VendorSubscription | null | undefined) {
  const limit = getKycLimit(subscription)
  if (limit === null) return null
  return Math.max(limit - (subscription?.kycVerificationsUsed ?? 0), 0)
}

// ── Team Users (concurrent count) ────────────────────────────────────────────

export function maxTeamUsers(subscription: VendorSubscription | null | undefined) {
  if (!subscription) return 0
  switch (subscription.planKey) {
    case SubscriptionPlanKey.STARTER:
    case SubscriptionPlanKey.PRO:
      return 1
    case SubscriptionPlanKey.BUSINESS:
      return 3
    case SubscriptionPlanKey.ENTERPRISE:
      return null
    default:
      return 0
  }
}
