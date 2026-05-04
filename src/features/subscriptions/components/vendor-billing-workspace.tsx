"use client"

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import {
  formatEuroAmount,
  subscriptionPlans,
  type SubscriptionBillingIntervalSlug,
  type SubscriptionPlanSlug,
} from "@/features/subscriptions/config"
import type {
  BillingInvoice,
  BillingPaymentMethod,
  BillingUsage,
  BillingWorkspace,
  SerializedSubscription,
} from "@/features/subscriptions/types"
import { cn } from "@/lib/utils"

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | number | null | undefined) {
  if (!iso) return "—"
  return new Date(typeof iso === "number" ? iso * 1000 : iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatCents(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100)
}

function brandIcon(brand: string) {
  const map: Record<string, string> = {
    visa: "VISA",
    mastercard: "MC",
    amex: "AMEX",
    discover: "DISC",
  }
  return map[brand.toLowerCase()] ?? brand.toUpperCase()
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "paid": return "success"
    case "open": return "warning"
    case "void": return "neutral"
    case "uncollectible": return "danger"
    default: return "neutral"
  }
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const tone = statusTone(status)
  const toneClasses = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-600",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  }
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize", toneClasses[tone])}>
      {status}
    </span>
  )
}

// ── Stripe Elements payment method form ───────────────────────────────────────

function PaymentMethodForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (pmId: string) => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: typeof window !== "undefined" ? window.location.href : "" },
      redirect: "if_required",
    })

    if (result.error) {
      setError(result.error.message ?? "Failed to save card.")
      setLoading(false)
      return
    }

    const pmId =
      typeof result.setupIntent?.payment_method === "string"
        ? result.setupIntent.payment_method
        : result.setupIntent?.payment_method?.id

    if (pmId) {
      onSuccess(pmId)
    } else {
      setError("Setup completed but could not retrieve payment method.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="sticky bottom-0 flex gap-2 bg-background pt-2 pb-1">
        <Button variant="outline" type="button" onClick={onCancel} disabled={loading} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !stripe || !elements} className="flex-1 bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]">
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save card
        </Button>
      </div>
    </form>
  )
}

// ── Plan comparison grid ──────────────────────────────────────────────────────

function BillingPlanGrid({
  currentPlanSlug,
  currentIntervalSlug,
  billingInterval,
  onChangePlan,
  onCheckoutPlan,
  canFreshCheckout,
  loading,
}: {
  currentPlanSlug: SubscriptionPlanSlug | null
  currentIntervalSlug: SubscriptionBillingIntervalSlug | null
  billingInterval: SubscriptionBillingIntervalSlug
  onChangePlan: (plan: SubscriptionPlanSlug, interval: SubscriptionBillingIntervalSlug) => void
  onCheckoutPlan?: (plan: SubscriptionPlanSlug, interval: SubscriptionBillingIntervalSlug) => void
  canFreshCheckout: boolean
  loading: string | null
}) {
  const router = useRouter()

  function handleSelect(planKey: SubscriptionPlanSlug) {
    if (planKey === "enterprise") {
      router.push("/contact")
      return
    }
    onChangePlan(planKey, billingInterval)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {subscriptionPlans.map((plan) => {
        const isCurrent = plan.key === currentPlanSlug && plan.key !== "enterprise" &&
          (currentIntervalSlug === null || currentIntervalSlug === billingInterval)
        const amount = billingInterval === "yearly" ? plan.yearlyAmountCents : plan.monthlyAmountCents
        const isLoadingThis = loading === plan.key
        const isAnyLoading = loading !== null
        const intervalMeta = billingInterval === "yearly" && plan.yearlyMonthlyEquivalentCents
          ? `/ an · ${formatEuroAmount(plan.yearlyMonthlyEquivalentCents)}/mois`
          : billingInterval === "yearly"
            ? "/ an"
            : "/ mois"

        let ctaLabel = plan.ctaLabel
        if (!plan.contactOnly && !canFreshCheckout && !isCurrent) {
          const currentPlanOrder = subscriptionPlans.findIndex((p) => p.key === currentPlanSlug)
          const thisPlanOrder = subscriptionPlans.findIndex((p) => p.key === plan.key)
          if (thisPlanOrder > currentPlanOrder) ctaLabel = "Upgrade"
          else ctaLabel = "Downgrade"
          if (currentIntervalSlug && currentIntervalSlug !== billingInterval && plan.key === currentPlanSlug) {
            ctaLabel = "Switch interval"
          }
        }

        return (
          <div
            key={plan.key}
            className={cn(
              "relative overflow-hidden rounded-[22px] border bg-background p-6 shadow-sm transition-all",
              plan.recommended
                ? "border-[var(--contrazy-teal)] shadow-[0_0_0_4px_rgba(17,201,176,0.08)]"
                : "border-border",
              isCurrent && "ring-2 ring-[var(--contrazy-teal)] ring-offset-2"
            )}
          >
            {plan.recommended && (
              <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(17,201,176,0.2),rgba(17,201,176,0.85),rgba(17,201,176,0.2))]" />
            )}

            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[17px] font-bold text-foreground">{plan.name}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{plan.subtitle}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {plan.recommended && (
                  <Badge className="border-transparent bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] hover:bg-[var(--contrazy-teal)]/10">
                    <Sparkles className="size-3" />
                    Recommandé
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="size-3" />
                    Actuel
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-4">
              {amount !== null ? (
                <>
                  <div className="flex items-end gap-1.5">
                    {billingInterval === "yearly" && plan.yearlyOriginalAmountCents && (
                      <span className="pb-0.5 text-base font-semibold text-muted-foreground/40 line-through">
                        {formatEuroAmount(plan.yearlyOriginalAmountCents)}
                      </span>
                    )}
                    <span className="text-[38px] font-extrabold tracking-tight text-foreground">
                      {formatEuroAmount(amount)}
                    </span>
                    <span className="pb-0.5 text-[13px] text-muted-foreground">HT</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{intervalMeta}</p>
                </>
              ) : (
                <>
                  <p className="text-[38px] font-extrabold tracking-tight text-foreground">Sur devis</p>
                  <p className="text-[11px] text-muted-foreground">Facturation annuelle</p>
                </>
              )}
            </div>

            <ul className="mt-4 space-y-2">
              {plan.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12px] leading-5 text-muted-foreground">
                  <Check className="mt-[1px] size-3.5 shrink-0 text-[var(--contrazy-teal)]" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-5">
              {isCurrent ? (
                <div className="flex h-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-[13px] font-semibold text-emerald-700">
                  <CheckCircle2 className="mr-2 size-4" />
                  Plan actuel
                </div>
              ) : (
                <Button
                  type="button"
                  className={cn(
                    "h-10 w-full rounded-xl text-[13px]",
                    plan.contactOnly
                      ? "border border-border bg-background text-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)]"
                      : plan.recommended || plan.key === "pro"
                        ? "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
                        : ""
                  )}
                  variant={plan.contactOnly || plan.key === "starter" ? "outline" : "default"}
                  disabled={isAnyLoading}
                  onClick={() =>
                    canFreshCheckout
                      ? onCheckoutPlan?.(plan.key, billingInterval)
                      : handleSelect(plan.key)
                  }
                >
                  {isLoadingThis ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {ctaLabel}
                  {!isLoadingThis ? <ArrowRight className="ml-2 size-4" /> : null}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── UsageSection ──────────────────────────────────────────────────────────────

function UsageBar({ used, limit, locked }: { used: number; limit: number | null; locked?: boolean }) {
  if (locked) {
    return (
      <div className="space-y-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" />
        <p className="text-[11px] text-muted-foreground">Not included in plan</p>
      </div>
    )
  }
  if (limit === null) {
    return <p className="text-[12px] font-semibold text-[var(--contrazy-teal)]">Unlimited · {used} used</p>
  }
  const pct = Math.min((used / Math.max(limit, 1)) * 100, 100)
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-[var(--contrazy-teal)]"
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <p className={cn("text-[11px]", pct >= 100 ? "text-destructive font-semibold" : "text-muted-foreground")}>
        {used} / {limit} used
      </p>
    </div>
  )
}

function UsageSection({ usage }: { usage: BillingUsage }) {
  const monthlyItems = [
    { label: "Transactions / month", used: usage.transactions.used, limit: usage.transactions.limit },
    { label: "E-Signatures / month", used: usage.eSignatures.used, limit: usage.eSignatures.limit },
    { label: "QR Codes / month", used: usage.qrCodes.used, limit: usage.qrCodes.limit },
    { label: "KYC verifications / month", used: usage.kyc.used, limit: usage.kyc.limit, locked: !usage.kyc.allowed },
  ]
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {monthlyItems.map((item) => (
          <div key={item.label} className="rounded-[18px] border border-border bg-background p-4 shadow-sm">
            <p className="text-[12px] font-semibold text-foreground">{item.label}</p>
            <div className="mt-2">
              <UsageBar used={item.used} limit={item.limit} locked={item.locked} />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-[18px] border border-border bg-background p-4 shadow-sm">
        <p className="text-[12px] font-semibold text-foreground">Contract templates</p>
        <div className="mt-2">
          <UsageBar used={usage.contractTemplates.used} limit={usage.contractTemplates.limit} />
        </div>
      </div>
    </div>
  )
}

// ── PaymentMethodSection ──────────────────────────────────────────────────────

function PaymentMethodSection({
  paymentMethods,
  hasActiveSubscription,
  onAdd,
  addLoading,
  onSetDefault,
  onDelete,
  actionLoadingId,
}: {
  paymentMethods: BillingPaymentMethod[]
  hasActiveSubscription: boolean
  onAdd: () => void
  addLoading: boolean
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void
  actionLoadingId: string | null
}) {
  return (
    <div className="rounded-[18px] border border-border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <span className="text-[13px] font-semibold text-foreground">Payment methods</span>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd} disabled={addLoading}>
          {addLoading ? <Loader2 className="mr-2 size-3.5 animate-spin" /> : null}
          Add card
        </Button>
      </div>

      {paymentMethods.length === 0 ? (
        <div className="px-5 py-6 text-center text-[13px] text-muted-foreground">
          No cards saved. Add one to continue.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {paymentMethods.map((pm) => {
            const isOnlyCard = paymentMethods.length === 1
            const canDelete = !(hasActiveSubscription && isOnlyCard)
            const busy = actionLoadingId === pm.id

            return (
              <li key={pm.id} className="flex items-center gap-3 px-5 py-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-[10px] font-bold text-muted-foreground">
                  {brandIcon(pm.brand)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground">
                      •••• {pm.last4}
                    </p>
                    {pm.isDefault && (
                      <span className="rounded-full bg-[var(--contrazy-teal)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--contrazy-teal)]">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Expires {pm.expMonth.toString().padStart(2, "0")}/{pm.expYear}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!pm.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-[12px]"
                      disabled={busy}
                      onClick={() => onSetDefault(pm.id)}
                    >
                      {busy ? <Loader2 className="size-3 animate-spin" /> : "Set default"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 w-7 p-0", canDelete ? "text-destructive hover:text-destructive" : "cursor-not-allowed opacity-40")}
                    disabled={busy || !canDelete}
                    title={!canDelete ? "Cannot remove the only card while subscription is active" : "Remove card"}
                    onClick={() => canDelete && onDelete(pm.id)}
                  >
                    {busy ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3.5" />}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── InvoiceTable ──────────────────────────────────────────────────────────────

function InvoiceTable({ invoices }: { invoices: BillingInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">Aucune facture pour le moment.</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="py-3 pr-4 text-left">Date</th>
            <th className="py-3 pr-4 text-left">Numéro</th>
            <th className="py-3 pr-4 text-left">Période</th>
            <th className="py-3 pr-4 text-right">Montant</th>
            <th className="py-3 pr-4 text-left">Statut</th>
            <th className="py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((inv) => (
            <tr key={inv.id} className="group">
              <td className="py-3 pr-4 text-muted-foreground">{formatDate(inv.created)}</td>
              <td className="py-3 pr-4 font-mono text-[12px] text-foreground">{inv.number ?? "—"}</td>
              <td className="py-3 pr-4 text-muted-foreground">
                {inv.periodStart && inv.periodEnd
                  ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`
                  : "—"}
              </td>
              <td className="py-3 pr-4 text-right font-semibold text-foreground">
                {formatCents(inv.amountDue, inv.currency)}
              </td>
              <td className="py-3 pr-4">
                <InvoiceStatusBadge status={inv.status} />
              </td>
              <td className="py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {inv.hostedInvoiceUrl && (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-[11px] text-[var(--contrazy-teal)] hover:underline">
                      <ExternalLink className="size-3" /> Voir
                    </a>
                  )}
                  {inv.invoicePdf && (
                    <a href={inv.invoicePdf} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                      <Download className="size-3" /> PDF
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SubscriptionStatusBand({ subscription }: { subscription: SerializedSubscription }) {
  const planDef = subscriptionPlans.find((plan) => plan.key === subscription.planSlug)
  const statusLabels: Record<string, string> = {
    ACTIVE: "Active",
    TRIALING: "Trial",
    PAST_DUE: "Past due",
    UNPAID: "Unpaid",
    INCOMPLETE: "Incomplete",
    CANCELED: "Canceled",
    INCOMPLETE_EXPIRED: "Expired",
  }
  const statusTones: Record<string, string> = {
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    TRIALING: "border-blue-200 bg-blue-50 text-blue-700",
    PAST_DUE: "border-red-200 bg-red-50 text-red-700",
    UNPAID: "border-red-200 bg-red-50 text-red-700",
    INCOMPLETE: "border-amber-200 bg-amber-50 text-amber-700",
    CANCELED: "border-slate-200 bg-slate-100 text-slate-600",
    INCOMPLETE_EXPIRED: "border-slate-200 bg-slate-100 text-slate-600",
  }
  const label = statusLabels[subscription.status] ?? subscription.status
  const toneClass = statusTones[subscription.status] ?? "border-slate-200 bg-slate-100 text-slate-600"

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-border bg-background px-6 py-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10">
          <CreditCard className="size-5 text-[var(--contrazy-teal)]" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-foreground">
            {planDef?.name ?? subscription.planKey} · {subscription.intervalSlug === "yearly" ? "Annuel" : "Mensuel"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", toneClass)}>
              {label}
            </span>
            {subscription.trialEnd && subscription.status === "TRIALING" ? (
              <span className="text-[12px] text-muted-foreground">
                Trial ends {formatDate(subscription.trialEnd)}
              </span>
            ) : null}
            {!subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && subscription.status !== "TRIALING" ? (
              <span className="text-[12px] text-muted-foreground">
                Renews {formatDate(subscription.currentPeriodEnd)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function VendorBillingWorkspace({
  workspace,
  stripePublishableKey,
}: {
  workspace: BillingWorkspace
  stripePublishableKey: string
}) {
  const router = useRouter()
  const stripePromise = useMemo(() => loadStripe(stripePublishableKey), [stripePublishableKey])

  const sub = workspace.subscription
  const isActive = workspace.access.allowed
  const isCanceling = sub?.cancelAtPeriodEnd === true && isActive
  const isRecovery = workspace.access.isRecoveryState
  const canFreshCheckout = workspace.access.canStartFreshCheckout

  const [billingInterval, setBillingInterval] = useState<SubscriptionBillingIntervalSlug>(
    sub?.intervalSlug === "yearly" ? "yearly" : "monthly"
  )
  const [planLoading, setPlanLoading] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Plan change modal
  const [planModal, setPlanModal] = useState<{
    open: boolean
    plan: SubscriptionPlanSlug | null
    interval: SubscriptionBillingIntervalSlug | null
  }>({ open: false, plan: null, interval: null })

  // Payment method modal
  const [pmModal, setPmModal] = useState(false)
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null)
  const [pmLoading, setPmLoading] = useState(false)
  const [pmActionLoadingId, setPmActionLoadingId] = useState<string | null>(null)

  // Cancel confirm modal
  const [cancelModal, setCancelModal] = useState(false)

  // 3DS / requires_action state
  const [actionRequired, setActionRequired] = useState<{
    open: boolean
    clientSecret: string
  } | null>(null)

  async function handleRequestPlanChange(plan: SubscriptionPlanSlug, interval: SubscriptionBillingIntervalSlug) {
    if (canFreshCheckout) return
    setPlanModal({ open: true, plan, interval })
  }

  async function handleFreshCheckout(plan: SubscriptionPlanSlug, interval: SubscriptionBillingIntervalSlug) {
    if (plan === "enterprise") {
      router.push("/contact")
      return
    }

    setPlanLoading(plan)
    try {
      const res = await fetch("/api/vendor/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: plan, billingInterval: interval }),
      })
      const data = await res.json()

      if (!res.ok || !data?.url) {
        toast({
          variant: "error",
          title: "Could not start checkout",
          description: data?.message ?? "Try again.",
        })
        return
      }

      window.location.assign(data.url)
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setPlanLoading(null)
    }
  }

  async function confirmPlanChange() {
    if (!planModal.plan || !planModal.interval) return

    setPlanLoading(planModal.plan)
    try {
      const res = await fetch("/api/vendor/subscription/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: planModal.plan, billingInterval: planModal.interval }),
      })
      const data = await res.json()
      setPlanModal({ open: false, plan: null, interval: null })

      if (!res.ok) {
        toast({ variant: "error", title: "Plan change failed", description: data.message ?? "Try again." })
        return
      }

      if (data.requiresAction && data.clientSecret) {
        setActionRequired({ open: true, clientSecret: data.clientSecret })
        return
      }

      toast({ variant: "success", title: "Plan updated", description: "Your subscription has been changed." })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setPlanLoading(null)
    }
  }

  async function handleCancel() {
    setActionLoading("cancel")
    try {
      const res = await fetch("/api/vendor/subscription/cancel", { method: "POST" })
      const data = await res.json()
      setCancelModal(false)
      if (!res.ok) {
        toast({ variant: "error", title: "Failed to cancel", description: data.message ?? "Try again." })
        return
      }
      toast({ variant: "info", title: "Subscription scheduled for cancellation", description: `Your access continues until ${formatDate(sub?.currentPeriodEnd)}.` })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReactivate() {
    setActionLoading("reactivate")
    try {
      const res = await fetch("/api/vendor/subscription/reactivate", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "error", title: "Failed to reactivate", description: data.message ?? "Try again." })
        return
      }
      toast({ variant: "success", title: "Subscription reactivated", description: "Your subscription will renew as normal." })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setActionLoading(null)
    }
  }

  async function openPaymentMethodModal() {
    setPmLoading(true)
    try {
      const res = await fetch("/api/vendor/subscription/payment-method/setup-intent", { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.clientSecret) {
        toast({ variant: "error", title: "Could not start update", description: data.message ?? "Try again." })
        return
      }
      setSetupClientSecret(data.clientSecret)
      setPmModal(true)
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setPmLoading(false)
    }
  }

  async function handlePaymentMethodSuccess(pmId: string) {
    try {
      const res = await fetch("/api/vendor/subscription/payment-method/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: pmId }),
      })
      const data = await res.json()
      setPmModal(false)
      setSetupClientSecret(null)
      if (!res.ok) {
        toast({ variant: "error", title: "Failed to save card", description: data.message ?? "Try again." })
        return
      }
      toast({ variant: "success", title: "Payment method updated", description: "Your new card has been saved." })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    }
  }

  async function handleSetDefaultPaymentMethod(pmId: string) {
    setPmActionLoadingId(pmId)
    try {
      const res = await fetch("/api/vendor/subscription/payment-method/set-default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: pmId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "error", title: "Failed", description: data.message ?? "Could not set default card." })
        return
      }
      toast({ variant: "success", title: "Default card updated" })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setPmActionLoadingId(null)
    }
  }

  async function handleDeletePaymentMethod(pmId: string) {
    setPmActionLoadingId(pmId)
    try {
      const res = await fetch(`/api/vendor/subscription/payment-method/${pmId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: "error", title: "Cannot remove card", description: data.message ?? "Try again." })
        return
      }
      toast({ variant: "success", title: "Card removed" })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setPmActionLoadingId(null)
    }
  }

  // Plan definition helpers
  const selectedPlanDef = planModal.plan ? subscriptionPlans.find((p) => p.key === planModal.plan) : null
  const intervalLabel = planModal.interval === "yearly" ? "annuel" : "mensuel"
  const planPrice = planModal.interval === "yearly"
    ? selectedPlanDef?.yearlyAmountCents
    : selectedPlanDef?.monthlyAmountCents
  const isIntervalChange = sub?.intervalSlug !== planModal.interval && planModal.plan === sub?.planSlug

  // ── State: No subscription / terminal ─────────────────────────────────────

  if (!sub || canFreshCheckout) {
    return (
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(180deg,#ffffff,rgba(244,248,249,0.94))] p-6 shadow-sm sm:p-8">
          <div className="space-y-3">
            <Badge className="w-fit border-transparent bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] hover:bg-[var(--contrazy-teal)]/10">
              Billing
            </Badge>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Activate your vendor workspace
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              Transactions, payments, KYC, contracts, and customer links are locked until an active subscription is in place.
              {sub?.status === "CANCELED" || sub?.status === "INCOMPLETE_EXPIRED"
                ? " Your previous subscription has ended — choose a plan to resubscribe."
                : ""}
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-muted-foreground">
            <span className={billingInterval === "monthly" ? "font-bold text-foreground" : ""}>Mensuel</span>
            <button
              type="button"
              onClick={() => setBillingInterval((v) => v === "monthly" ? "yearly" : "monthly")}
              className="relative h-7 w-[54px] cursor-pointer rounded-full transition-colors"
              style={{ background: billingInterval === "yearly" ? "var(--contrazy-teal)" : "#CBD5E1" }}
              aria-label="Toggle billing interval"
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className="absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-sm"
                style={{ transform: billingInterval === "yearly" ? "translateX(24px)" : "translateX(0)" }}
              />
            </button>
            <span className={billingInterval === "yearly" ? "font-bold text-foreground" : ""}>Annuel</span>
            <span className="rounded-full bg-[#E8FAF7] px-2.5 py-0.5 text-[11px] font-bold text-[var(--contrazy-teal)]">
              {billingInterval === "yearly" ? "-15%" : "Jusqu'à -15%"}
            </span>
          </div>
          <BillingPlanGrid
            currentPlanSlug={null}
            currentIntervalSlug={null}
            billingInterval={billingInterval}
            onChangePlan={handleRequestPlanChange}
            onCheckoutPlan={handleFreshCheckout}
            canFreshCheckout={true}
            loading={planLoading}
          />
        </section>
      </div>
    )
  }

  // ── State: Recovery ────────────────────────────────────────────────────────

  if (isRecovery) {
    return (
      <div className="space-y-6">
        <SubscriptionStatusBand subscription={sub} />

        <div className="flex items-start gap-4 rounded-[22px] border border-red-200 bg-red-50/60 p-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-red-800">Payment issue — action required</p>
            <p className="text-sm text-red-700">
              {sub.status === "PAST_DUE"
                ? "Your latest invoice could not be collected. Please update your payment method to restore full access."
                : sub.status === "UNPAID"
                  ? "Your subscription is unpaid. Update your payment method and we will retry."
                  : "Your payment is incomplete. Please update your payment method to activate your subscription."}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-red-600 text-white hover:bg-red-700 shrink-0"
            onClick={openPaymentMethodModal}
            disabled={pmLoading}
          >
            {pmLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Update payment method
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Payment methods</h3>
            <PaymentMethodSection
              paymentMethods={workspace.paymentMethods}
              hasActiveSubscription={isActive}
              onAdd={openPaymentMethodModal}
              addLoading={pmLoading}
              onSetDefault={handleSetDefaultPaymentMethod}
              onDelete={handleDeletePaymentMethod}
              actionLoadingId={pmActionLoadingId}
            />
          </div>
          <div className="space-y-4">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Recent invoices</h3>
            <div className="rounded-[18px] border border-border bg-background p-4 shadow-sm">
              <InvoiceTable invoices={workspace.invoices.slice(0, 3)} />
            </div>
          </div>
        </div>

        {/* Payment method modal */}
        <Dialog open={pmModal} onOpenChange={(open) => { if (!open) { setPmModal(false); setSetupClientSecret(null) } }}>
          <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-md">
            <DialogHeader className="shrink-0">
              <DialogTitle>Update payment method</DialogTitle>
              <DialogDescription>Enter your card details. Your existing subscription will be retried with the new card.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">
              {setupClientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                  <PaymentMethodForm onSuccess={handlePaymentMethodSuccess} onCancel={() => { setPmModal(false); setSetupClientSecret(null) }} />
                </Elements>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── State: Active / Canceling ──────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <SubscriptionStatusBand subscription={sub} />

      {/* Canceling banner */}
      <AnimatePresence>
        {isCanceling && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center justify-between gap-4 rounded-[22px] border border-amber-200 bg-amber-50/60 px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 shrink-0 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">
                Your subscription ends on <strong>{formatDate(sub.currentPeriodEnd)}</strong>. Reactivate to keep access.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
              onClick={handleReactivate}
              disabled={actionLoading === "reactivate"}
            >
              {actionLoading === "reactivate" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
              Reactivate
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Usage */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Usage this period</h2>
        <UsageSection usage={workspace.usage} />
        {workspace.usage.periodEnd && (
          <p className="text-[12px] text-muted-foreground">
            Usage resets on {formatDate(workspace.usage.periodEnd)}
          </p>
        )}
      </section>

      {/* Plan grid */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Plans</h2>
          <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
            <span className={billingInterval === "monthly" ? "font-bold text-foreground" : ""}>Mensuel</span>
            <button
              type="button"
              onClick={() => setBillingInterval((v) => v === "monthly" ? "yearly" : "monthly")}
              className="relative h-7 w-[54px] cursor-pointer rounded-full transition-colors"
              style={{ background: billingInterval === "yearly" ? "var(--contrazy-teal)" : "#CBD5E1" }}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className="absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-sm"
                style={{ transform: billingInterval === "yearly" ? "translateX(24px)" : "translateX(0)" }}
              />
            </button>
            <span className={billingInterval === "yearly" ? "font-bold text-foreground" : ""}>Annuel</span>
            <span className="rounded-full bg-[#E8FAF7] px-2.5 py-0.5 text-[11px] font-bold text-[var(--contrazy-teal)]">
              {billingInterval === "yearly" ? "-15%" : "Jusqu'à -15%"}
            </span>
          </div>
        </div>
        <BillingPlanGrid
          currentPlanSlug={sub.planSlug}
          currentIntervalSlug={sub.intervalSlug}
          billingInterval={billingInterval}
          onChangePlan={handleRequestPlanChange}
          onCheckoutPlan={handleFreshCheckout}
          canFreshCheckout={false}
          loading={planLoading}
        />
      </section>

      {/* Payment methods */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Payment methods</h2>
        <PaymentMethodSection
          paymentMethods={workspace.paymentMethods}
          hasActiveSubscription={isActive}
          onAdd={openPaymentMethodModal}
          addLoading={pmLoading}
          onSetDefault={handleSetDefaultPaymentMethod}
          onDelete={handleDeletePaymentMethod}
          actionLoadingId={pmActionLoadingId}
        />
      </section>

      {/* Invoices */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice history</h2>
        <div className="overflow-hidden rounded-[18px] border border-border bg-background shadow-sm">
          <div className="p-4">
            <InvoiceTable invoices={workspace.invoices} />
          </div>
        </div>
      </section>

      {/* Danger zone */}
      {!isCanceling && (
        <section className="space-y-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Danger zone</h2>
          <div className="rounded-[18px] border border-red-200/60 bg-background p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Cancel subscription</p>
                <p className="text-[12px] text-muted-foreground">
                  Your access continues until {formatDate(sub.currentPeriodEnd)}. You can reactivate before that date.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setCancelModal(true)}
                disabled={actionLoading !== null}
              >
                <XCircle className="mr-2 size-4" />
                Cancel plan
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Plan change modal */}
      <Dialog open={planModal.open} onOpenChange={(open) => { if (!planLoading) setPlanModal((p) => ({ ...p, open })) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm plan change</DialogTitle>
            <DialogDescription>
              Review the details before confirming.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">New plan</span>
              <span className="font-semibold">
                {selectedPlanDef?.name} · {intervalLabel}
              </span>
            </div>
            {planPrice !== null && planPrice !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold">{formatEuroAmount(planPrice)} HT</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Effective</span>
              <span className="font-semibold">Immediately</span>
            </div>
            {isIntervalChange && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
                Billing cycle resets today. A prorated invoice will be issued immediately.
              </div>
            )}
            {!isIntervalChange && (
              <div className="rounded-xl border border-border bg-background px-3 py-2 text-[12px] text-muted-foreground">
                A prorated credit or charge will be applied to your next invoice.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanModal({ open: false, plan: null, interval: null })} disabled={!!planLoading}>
              Cancel
            </Button>
            <Button
              onClick={confirmPlanChange}
              disabled={!!planLoading}
              className="bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]"
            >
              {planLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirm modal */}
      <Dialog open={cancelModal} onOpenChange={(open) => { if (actionLoading !== "cancel") setCancelModal(open) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-destructive" />
              Cancel subscription
            </DialogTitle>
            <DialogDescription>
              Your workspace stays active until <strong>{formatDate(sub.currentPeriodEnd)}</strong>. You can reactivate before that date.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModal(false)} disabled={actionLoading === "cancel"}>
              Keep subscription
            </Button>
            <Button
              onClick={handleCancel}
              disabled={actionLoading === "cancel"}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {actionLoading === "cancel" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Cancel at period end
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment method modal */}
      <Dialog open={pmModal} onOpenChange={(open) => { if (!open) { setPmModal(false); setSetupClientSecret(null) } }}>
        <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Update payment method</DialogTitle>
            <DialogDescription>Enter your new card. It will be used for all future charges.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">
            {setupClientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                <PaymentMethodForm onSuccess={handlePaymentMethodSuccess} onCancel={() => { setPmModal(false); setSetupClientSecret(null) }} />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 3DS requires_action modal */}
      <Dialog open={actionRequired?.open ?? false} onOpenChange={() => setActionRequired(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Payment confirmation required</DialogTitle>
            <DialogDescription>
              Your bank requires additional authentication to complete this change.
            </DialogDescription>
          </DialogHeader>
          {actionRequired?.clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret: actionRequired.clientSecret }}>
              <PaymentMethodForm
                onSuccess={() => { setActionRequired(null); router.refresh() }}
                onCancel={() => setActionRequired(null)}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
