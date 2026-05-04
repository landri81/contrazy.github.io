import type { SubscriptionBillingIntervalSlug, SubscriptionPlanSlug } from "@/features/subscriptions/config"

export type SerializedSubscription = {
  id: string
  planKey: string
  planSlug: SubscriptionPlanSlug
  billingInterval: string
  intervalSlug: SubscriptionBillingIntervalSlug
  status: string
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialStart: string | null
  trialEnd: string | null
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
}

export type BillingAccessInfo = {
  allowed: boolean
  reason: "active" | "missing" | "inactive"
  isRecoveryState: boolean
  canStartFreshCheckout: boolean
}

export type BillingUsage = {
  transactions: { used: number; limit: number | null; remaining: number | null }
  eSignatures: { used: number; limit: number | null; remaining: number | null }
  qrCodes: { used: number; limit: number | null; remaining: number | null }
  contractTemplates: { used: number; limit: number | null }
  kyc: { used: number; limit: number | null; remaining: number | null; allowed: boolean }
  teamUsers: { used: number; limit: number | null }
  periodStart: string | null
  periodEnd: string | null
}

export type BillingPaymentMethod = {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

export type BillingInvoice = {
  id: string
  number: string | null
  status: string
  amountDue: number
  amountPaid: number
  currency: string
  created: number
  periodStart: number | null
  periodEnd: number | null
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}

export type BillingWorkspace = {
  subscription: SerializedSubscription | null
  access: BillingAccessInfo
  usage: BillingUsage
  paymentMethods: BillingPaymentMethod[]
  invoices: BillingInvoice[]
}

export type ChangePlanResult = {
  requiresAction: boolean
  clientSecret: string | null
}
