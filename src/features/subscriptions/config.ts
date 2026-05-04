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

export const subscriptionPlans: SubscriptionPlanDefinition[] = [
  {
    key: "starter",
    name: "Starter",
    subtitle: "Indépendants · 1 utilisateur",
    monthlyAmountCents: 900,
    yearlyAmountCents: 9200,
    yearlyOriginalAmountCents: 10800,
    yearlyMonthlyEquivalentCents: 800,
    billingLabel: "Sans engagement",
    ctaLabel: "Commencer",
    contactOnly: false,
    items: [
      "10 transactions / mois",
      "10 e-signatures / mois",
      "2 QR Codes",
      "1 modèle de contrat",
      "Envoi par email",
      "KYC non inclus",
    ],
    features: {
      transactionsPerPeriod: 10,
      eSignaturesPerPeriod: 10,
      kycPerPeriod: 0,
      qrCodesPerPeriod: 2,
      teamUsers: 1,
      allowsKyc: false,
    },
  },
  {
    key: "pro",
    name: "Pro",
    subtitle: "Loueurs · Prestataires",
    monthlyAmountCents: 2400,
    yearlyAmountCents: 24500,
    yearlyOriginalAmountCents: 28800,
    yearlyMonthlyEquivalentCents: 2000,
    billingLabel: "Essai gratuit 7 jours",
    ctaLabel: "Essai gratuit 7 jours",
    contactOnly: false,
    items: [
      "Everything in Starter",
      "Transactions illimitées",
      "E-signatures illimitées",
      "10 vérifications KYC / mois",
      "Contrats auto-générés",
      "QR Codes illimités",
      "Profils clients persistants",
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
    subtitle: "Gestionnaires · Équipes",
    monthlyAmountCents: 4900,
    yearlyAmountCents: 50000,
    yearlyOriginalAmountCents: 58800,
    yearlyMonthlyEquivalentCents: 4200,
    billingLabel: "Essai gratuit 7 jours",
    badge: "Recommandé",
    recommended: true,
    ctaLabel: "Essai gratuit 7 jours",
    contactOnly: false,
    items: [
      "Everything in Pro",
      "25 vérifications KYC / mois",
      "Contrats illimités",
      "Workflow litiges",
      "3 utilisateurs",
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
    subtitle: "API · Marque blanche",
    monthlyAmountCents: null,
    yearlyAmountCents: null,
    yearlyOriginalAmountCents: null,
    yearlyMonthlyEquivalentCents: null,
    billingLabel: "Facturation annuelle",
    ctaLabel: "Nous contacter",
    contactOnly: true,
    items: [
      "Everything in Business",
      "API REST + webhooks",
      "Marque blanche complète",
      "KYC illimité",
      "Utilisateurs illimités",
      "SLA + support dédié",
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
