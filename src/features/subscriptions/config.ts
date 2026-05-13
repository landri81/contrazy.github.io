import type { UserRole } from "@/lib/auth/roles"

export const subscriptionPlanKeys = ["starter", "pro", "business", "enterprise"] as const
export const subscriptionBillingIntervals = ["monthly", "yearly"] as const

export type SubscriptionPlanSlug = (typeof subscriptionPlanKeys)[number]
export type SubscriptionBillingIntervalSlug = (typeof subscriptionBillingIntervals)[number]

type SubscriptionPlanFeatures = {
  transactionsPerPeriod: number | null
  eSignaturesPerPeriod: number | null
  kycPerPeriod: number | null
  qrCodesPerPeriod: number | null
  teamUsers: number | null
  allowsKyc: boolean
}

export type SubscriptionPlanDefinition = {
  key: SubscriptionPlanSlug
  name: string
  subtitle: string
  monthlyAmountCents: number | null
  yearlyAmountCents: number | null
  yearlyOriginalAmountCents: number | null
  yearlyMonthlyEquivalentCents: number | null
  billingLabel: string
  badge?: string
  recommended?: boolean
  ctaLabel: string
  contactOnly: boolean
  items: string[]
  features: SubscriptionPlanFeatures
}

type SubscriptionPlanTranslationKey =
  | "starter.name"
  | "starter.subtitle"
  | "starter.billingLabel"
  | "starter.ctaLabel"
  | "starter.items.0"
  | "starter.items.1"
  | "starter.items.2"
  | "starter.items.3"
  | "starter.items.4"
  | "starter.items.5"
  | "starter.items.6"
  | "starter.items.7"
  | "pro.name"
  | "pro.subtitle"
  | "pro.billingLabel"
  | "pro.ctaLabel"
  | "pro.items.0"
  | "pro.items.1"
  | "pro.items.2"
  | "pro.items.3"
  | "pro.items.4"
  | "pro.items.5"
  | "pro.items.6"
  | "pro.items.7"
  | "business.name"
  | "business.subtitle"
  | "business.billingLabel"
  | "business.badge"
  | "business.ctaLabel"
  | "business.items.0"
  | "business.items.1"
  | "business.items.2"
  | "business.items.3"
  | "business.items.4"
  | "business.items.5"
  | "enterprise.name"
  | "enterprise.subtitle"
  | "enterprise.billingLabel"
  | "enterprise.ctaLabel"
  | "enterprise.items.0"
  | "enterprise.items.1"
  | "enterprise.items.2"
  | "enterprise.items.3"
  | "enterprise.items.4"
  | "enterprise.items.5"

type SubscriptionPlanTranslationFn = (key: SubscriptionPlanTranslationKey) => string

const subscriptionPlanTranslationKeys = {
  starter: {
    name: "starter.name",
    subtitle: "starter.subtitle",
    billingLabel: "starter.billingLabel",
    ctaLabel: "starter.ctaLabel",
    items: [
      "starter.items.0",
      "starter.items.1",
      "starter.items.2",
      "starter.items.3",
      "starter.items.4",
      "starter.items.5",
      "starter.items.6",
      "starter.items.7",
    ],
  },
  pro: {
    name: "pro.name",
    subtitle: "pro.subtitle",
    billingLabel: "pro.billingLabel",
    ctaLabel: "pro.ctaLabel",
    items: [
      "pro.items.0",
      "pro.items.1",
      "pro.items.2",
      "pro.items.3",
      "pro.items.4",
      "pro.items.5",
      "pro.items.6",
      "pro.items.7",
    ],
  },
  business: {
    name: "business.name",
    subtitle: "business.subtitle",
    billingLabel: "business.billingLabel",
    badge: "business.badge",
    ctaLabel: "business.ctaLabel",
    items: [
      "business.items.0",
      "business.items.1",
      "business.items.2",
      "business.items.3",
      "business.items.4",
      "business.items.5",
    ],
  },
  enterprise: {
    name: "enterprise.name",
    subtitle: "enterprise.subtitle",
    billingLabel: "enterprise.billingLabel",
    ctaLabel: "enterprise.ctaLabel",
    items: [
      "enterprise.items.0",
      "enterprise.items.1",
      "enterprise.items.2",
      "enterprise.items.3",
      "enterprise.items.4",
      "enterprise.items.5",
    ],
  },
} as const

export const subscriptionPlans: SubscriptionPlanDefinition[] = [
  {
    key: "starter",
    name: "Starter",
    subtitle: "Solo operators · 1 user",
    monthlyAmountCents: 900,
    yearlyAmountCents: 9200,
    yearlyOriginalAmountCents: 10800,
    yearlyMonthlyEquivalentCents: 800,
    billingLabel: "No commitment",
    ctaLabel: "Get started",
    contactOnly: false,
    items: [
      "10 transactions / month",
      "10 e-signatures / month",
      "2 QR codes",
      "1 KYC verification / month",
      "1 contract template",
      "Email delivery",
      "Stripe Identity included",
      "7-day card authorization",
    ],
    features: {
      transactionsPerPeriod: 10,
      eSignaturesPerPeriod: 10,
      kycPerPeriod: 1,
      qrCodesPerPeriod: 2,
      teamUsers: 1,
      allowsKyc: true,
    },
  },
  {
    key: "pro",
    name: "Pro",
    subtitle: "Rentals · Service businesses",
    monthlyAmountCents: 2400,
    yearlyAmountCents: 24500,
    yearlyOriginalAmountCents: 28800,
    yearlyMonthlyEquivalentCents: 2000,
    billingLabel: "7-day free trial",
    ctaLabel: "Start 7-day trial",
    contactOnly: false,
    items: [
      "Everything in Starter",
      "Unlimited transactions",
      "Unlimited e-signatures",
      "10 KYC verifications / month",
      "Auto-generated contracts",
      "Unlimited QR codes",
      "Persistent client profiles",
      "14-day deposit refund window",
    ],
    features: {
      transactionsPerPeriod: null,
      eSignaturesPerPeriod: null,
      kycPerPeriod: 10,
      qrCodesPerPeriod: null,
      teamUsers: 1,
      allowsKyc: true,
    },
  },
  {
    key: "business",
    name: "Business",
    subtitle: "Managers · Teams",
    monthlyAmountCents: 4900,
    yearlyAmountCents: 50000,
    yearlyOriginalAmountCents: 58800,
    yearlyMonthlyEquivalentCents: 4200,
    billingLabel: "7-day free trial",
    badge: "Recommended",
    recommended: true,
    ctaLabel: "Start 7-day trial",
    contactOnly: false,
    items: [
      "Everything in Pro",
      "25 KYC verifications / month",
      "Unlimited contracts",
      "Dispute management workflow",
      "3 users",
      "30-day deposit refund window",
    ],
    features: {
      transactionsPerPeriod: null,
      eSignaturesPerPeriod: null,
      kycPerPeriod: 25,
      qrCodesPerPeriod: null,
      teamUsers: 3,
      allowsKyc: true,
    },
  },
  {
    key: "enterprise",
    name: "Enterprise",
    subtitle: "API · White-label",
    monthlyAmountCents: null,
    yearlyAmountCents: null,
    yearlyOriginalAmountCents: null,
    yearlyMonthlyEquivalentCents: null,
    billingLabel: "Annual billing",
    ctaLabel: "Contact us",
    contactOnly: true,
    items: [
      "Everything in Business",
      "REST API and webhooks",
      "Full white-label",
      "Unlimited KYC",
      "Unlimited users",
      "SLA and dedicated support",
    ],
    features: {
      transactionsPerPeriod: null,
      eSignaturesPerPeriod: null,
      kycPerPeriod: null,
      qrCodesPerPeriod: null,
      teamUsers: null,
      allowsKyc: true,
    },
  },
]

export const subscriptionPlanMap = Object.fromEntries(
  subscriptionPlans.map((plan) => [plan.key, plan])
) as Record<SubscriptionPlanSlug, SubscriptionPlanDefinition>

export function getLocalizedSubscriptionPlans(
  t: SubscriptionPlanTranslationFn
): SubscriptionPlanDefinition[] {
  return subscriptionPlans.map((plan) => {
    const translationKeys = subscriptionPlanTranslationKeys[plan.key]

    return {
      ...plan,
      name: t(translationKeys.name),
      subtitle: t(translationKeys.subtitle),
      billingLabel: t(translationKeys.billingLabel),
      badge: plan.key === "business" ? t(subscriptionPlanTranslationKeys.business.badge) : undefined,
      ctaLabel: t(translationKeys.ctaLabel),
      items: translationKeys.items.map((key) => t(key)),
    }
  })
}

export function parseSubscriptionPlanKey(value: string | null | undefined): SubscriptionPlanSlug | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return subscriptionPlanKeys.includes(normalized as SubscriptionPlanSlug)
    ? (normalized as SubscriptionPlanSlug)
    : null
}

export function parseSubscriptionBillingInterval(
  value: string | null | undefined
): SubscriptionBillingIntervalSlug | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return subscriptionBillingIntervals.includes(normalized as SubscriptionBillingIntervalSlug)
    ? (normalized as SubscriptionBillingIntervalSlug)
    : null
}

export function resolveMarketingPlanHref(role: UserRole | null | undefined, planKey: SubscriptionPlanSlug) {
  if (planKey === "enterprise") {
    return "/contact"
  }

  if (role === "VENDOR") {
    return "/vendor/subscribe"
  }

  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return "/admin"
  }

  return "/register"
}

export function formatEuroAmount(amountCents: number | null) {
  if (amountCents === null) {
    return "Sur devis"
  }

  return `${Math.round(amountCents / 100)}€`
}
