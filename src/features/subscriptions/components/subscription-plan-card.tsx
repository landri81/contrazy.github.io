"use client"

import { ArrowRight, Check, CheckCircle2, Loader2, Sparkles } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatEuroAmount,
  type SubscriptionBillingIntervalSlug,
  type SubscriptionPlanDefinition,
} from "@/features/subscriptions/config"
import { cn } from "@/lib/utils"

type SubscriptionPlanCardProps = {
  plan: SubscriptionPlanDefinition
  billingInterval: SubscriptionBillingIntervalSlug
  isCurrent?: boolean
  isLoading?: boolean
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  actionDisabled?: boolean
}

export function SubscriptionPlanCard({
  plan,
  billingInterval,
  isCurrent = false,
  isLoading = false,
  actionLabel,
  actionHref,
  onAction,
  actionDisabled = false,
}: SubscriptionPlanCardProps) {
  const amount =
    billingInterval === "yearly"
      ? plan.yearlyAmountCents
      : plan.monthlyAmountCents

  const intervalMeta =
    billingInterval === "yearly" && plan.yearlyMonthlyEquivalentCents
      ? `/ an · ${formatEuroAmount(plan.yearlyMonthlyEquivalentCents)}/mois`
      : billingInterval === "yearly"
        ? "/ an"
        : "/ mois"

  const buttonLabel = actionLabel ?? plan.ctaLabel
  const actionTone = plan.contactOnly
    ? "secondary"
    : plan.recommended || plan.key === "pro"
      ? "primary"
      : "outline"

  const buttonClassName = cn(
    "h-11 w-full rounded-xl text-[13px] font-semibold transition-all",
    actionTone === "primary" &&
      "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
    actionTone === "outline" &&
      "border border-border bg-background text-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)]",
    actionTone === "secondary" &&
      "border border-border bg-background text-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)]"
  )

  return (
    <div
      className={cn(
        "relative flex h-full min-h-[450px] flex-col overflow-hidden rounded-[22px] border bg-background p-6 shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md",
        plan.recommended
          ? "border-[var(--contrazy-teal)] shadow-[0_0_0_4px_rgba(17,201,176,0.08)]"
          : "border-border",
        isCurrent && "ring-2 ring-[var(--contrazy-teal)] ring-offset-2"
      )}
    >
      {plan.recommended ? (
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(17,201,176,0.18),rgba(17,201,176,0.9),rgba(17,201,176,0.18))]" />
      ) : null}

      <div className="flex min-h-[58px] items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-tight text-foreground">
            {plan.name}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            {plan.subtitle}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {plan.badge ? (
            <Badge className="gap-1 border-transparent bg-[var(--contrazy-teal)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--contrazy-teal)] hover:bg-[var(--contrazy-teal)]/10">
              <Sparkles className="size-3" />
              {plan.badge}
            </Badge>
          ) : null}

          {isCurrent ? (
            <Badge className="gap-1 border-transparent bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100">
              <CheckCircle2 className="size-3" />
              Actuel
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex min-h-[76px] flex-col justify-end">
        {amount !== null ? (
          <>
            <div className="flex items-end gap-1.5">
              {billingInterval === "yearly" && plan.yearlyOriginalAmountCents ? (
                <span className="pb-1 text-base font-semibold text-muted-foreground/40 line-through">
                  {formatEuroAmount(plan.yearlyOriginalAmountCents)}
                </span>
              ) : null}

              <span className="text-[38px] font-extrabold leading-none tracking-tight text-foreground">
                {formatEuroAmount(amount)}
              </span>

              <span className="pb-1 text-[13px] text-muted-foreground">
                HT
              </span>
            </div>

            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              {intervalMeta}
            </p>
          </>
        ) : (
          <>
            <p className="text-[38px] font-extrabold leading-none tracking-tight text-foreground">
              Sur devis
            </p>

            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Facturation annuelle
            </p>
          </>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-[12px] leading-5 text-muted-foreground"
          >
            <Check className="mt-[3px] size-3.5 shrink-0 text-[var(--contrazy-teal)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 pt-2">
        {isCurrent ? (
          <div className="flex h-11 w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-[13px] font-semibold text-emerald-700">
            <CheckCircle2 className="mr-2 size-4" />
            Plan actuel
          </div>
        ) : actionHref ? (
          <Link href={actionHref} className={cn("inline-flex items-center justify-center gap-2", buttonClassName)}>
            {buttonLabel}
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Button
            type="button"
            className={buttonClassName}
            variant={actionTone === "primary" ? "default" : "outline"}
            disabled={actionDisabled || isLoading}
            onClick={onAction}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            {buttonLabel}
            {!isLoading ? <ArrowRight className="size-4" /> : null}
          </Button>
        )}
      </div>
    </div>
  )
}
