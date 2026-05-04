"use client"

import { useMemo, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"

import {
  resolveMarketingPlanHref,
  subscriptionPlans,
  type SubscriptionBillingIntervalSlug,
  type SubscriptionPlanSlug,
} from "@/features/subscriptions/config"
import { SubscriptionPlanCard } from "@/features/subscriptions/components/subscription-plan-card"
import type { UserRole } from "@/lib/auth/roles"

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
          const isLoading = pendingPlan === plan.key && isPending
          const href = resolveMarketingPlanHref(viewerRole, plan.key)

          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              <SubscriptionPlanCard
                plan={plan}
                billingInterval={billingInterval}
                isLoading={isLoading}
                actionDisabled={isPending}
                actionHref={mode === "marketing" ? href : undefined}
                onAction={mode === "vendor" ? () => handleVendorPlanSelect(plan.key) : undefined}
              />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
