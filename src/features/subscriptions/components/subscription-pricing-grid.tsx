"use client"

import { useMemo, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatEuroAmount,
  resolveMarketingPlanHref,
  subscriptionPlans,
  type SubscriptionBillingIntervalSlug,
  type SubscriptionPlanSlug,
} from "@/features/subscriptions/config"
import type { UserRole } from "@/lib/auth/roles"
import { cn } from "@/lib/utils"

type SubscriptionPricingGridProps = {
  mode: "marketing" | "vendor"
  viewerRole?: UserRole | null
  initialInterval?: SubscriptionBillingIntervalSlug
}

export function SubscriptionPricingGrid({
  mode,
  viewerRole = null,
  initialInterval = "monthly",
}: SubscriptionPricingGridProps) {
  const router = useRouter()
  const [billingInterval, setBillingInterval] = useState<SubscriptionBillingIntervalSlug>(initialInterval)
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlanSlug | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const discountLabel = useMemo(() => {
    return billingInterval === "yearly" ? "-15%" : "Jusqu'à -15%"
  }, [billingInterval])

  function handleVendorPlanSelect(planKey: SubscriptionPlanSlug) {
    if (planKey === "enterprise") {
      router.push("/contact")
      return
    }

    setError(null)
    setPendingPlan(planKey)

    startTransition(async () => {
      try {
        const response = await fetch("/api/vendor/subscription/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planKey,
            billingInterval,
          }),
        })

        const data = await response.json()

        if (!response.ok || !data?.url) {
          setError(data?.message ?? "Unable to start the checkout session.")
          setPendingPlan(null)
          return
        }

        window.location.href = data.url
      } catch {
        setError("Unable to start the checkout session.")
        setPendingPlan(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-muted-foreground">
        <span className={billingInterval === "monthly" ? "font-bold text-foreground" : ""}>Mensuel</span>
        <button
          type="button"
          onClick={() => setBillingInterval((value) => (value === "monthly" ? "yearly" : "monthly"))}
          className="relative h-7 w-[54px] cursor-pointer rounded-full transition-colors"
          style={{ background: billingInterval === "yearly" ? "var(--contrazy-teal)" : "#CBD5E1" }}
          aria-label="Toggle billing interval"
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow-sm"
            style={{
              transform: billingInterval === "yearly" ? "translateX(24px)" : "translateX(0)",
            }}
          />
        </button>
        <span className={billingInterval === "yearly" ? "font-bold text-foreground" : ""}>Annuel</span>
        <span className="rounded-full bg-[#E8FAF7] px-2.5 py-0.5 text-[11px] font-bold text-[var(--contrazy-teal)]">
          {discountLabel}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {subscriptionPlans.map((plan, index) => {
          const amount =
            billingInterval === "yearly" ? plan.yearlyAmountCents : plan.monthlyAmountCents
          const isLoading = pendingPlan === plan.key && isPending
          const href = resolveMarketingPlanHref(viewerRole, plan.key)
          const intervalMeta =
            billingInterval === "yearly"
              ? plan.yearlyMonthlyEquivalentCents
                ? `/ an · soit ${formatEuroAmount(plan.yearlyMonthlyEquivalentCents)}/mois`
                : "facturation annuelle"
              : plan.monthlyAmountCents
                ? "/ mois"
                : "facturation annuelle"

          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "relative overflow-hidden rounded-[22px] border bg-background p-7 shadow-sm transition-all",
                plan.recommended
                  ? "border-[var(--contrazy-teal)] shadow-[0_0_0_4px_rgba(17,201,176,0.08)]"
                  : "border-border hover:-translate-y-0.5 hover:shadow-xl"
              )}
            >
              {plan.recommended ? (
                <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(17,201,176,0.2),rgba(17,201,176,0.85),rgba(17,201,176,0.2))]" />
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[18px] font-bold text-foreground">{plan.name}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">{plan.subtitle}</p>
                </div>
                {plan.badge ? (
                  <Badge className="border-transparent bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] hover:bg-[var(--contrazy-teal)]/10">
                    <Sparkles className="size-3.5" />
                    {plan.badge}
                  </Badge>
                ) : null}
              </div>

              <div className="mt-6">
                {amount !== null ? (
                  <>
                    <div className="flex items-end gap-2">
                      {billingInterval === "yearly" && plan.yearlyOriginalAmountCents ? (
                        <span className="pb-1 text-lg font-semibold text-muted-foreground/50 line-through">
                          {formatEuroAmount(plan.yearlyOriginalAmountCents)}
                        </span>
                      ) : null}
                      <span className="text-[42px] font-extrabold tracking-tight text-foreground">
                        {formatEuroAmount(amount)}
                      </span>
                      <span className="pb-1 text-[14px] text-muted-foreground">HT</span>
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">{intervalMeta}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[42px] font-extrabold tracking-tight text-foreground">Sur devis</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">Facturation annuelle</p>
                  </>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  Inclus
                </p>
                <ul className="mt-3 space-y-2.5">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[13px] leading-6 text-muted-foreground">
                      <Check className="mt-[2px] size-4 shrink-0 text-[var(--contrazy-teal)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6">
                {mode === "vendor" ? (
                  <Button
                    type="button"
                    className={cn(
                      "h-11 w-full cursor-pointer rounded-xl",
                      plan.contactOnly
                        ? "border border-border bg-background text-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)]"
                        : plan.recommended || plan.key === "pro"
                          ? "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
                          : ""
                    )}
                    variant={plan.contactOnly || plan.key === "starter" ? "outline" : "default"}
                    disabled={isPending}
                    onClick={() => handleVendorPlanSelect(plan.key)}
                  >
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {plan.ctaLabel}
                    {!isLoading ? <ArrowRight className="size-4" /> : null}
                  </Button>
                ) : (
                  <Link
                    href={href}
                    className={cn(
                      "inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-all",
                      plan.contactOnly
                        ? "border border-border bg-background text-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)]"
                        : plan.recommended || plan.key === "pro"
                          ? "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
                          : "border border-border bg-background text-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)]"
                    )}
                  >
                    {plan.ctaLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
