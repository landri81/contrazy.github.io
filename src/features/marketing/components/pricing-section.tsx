"use client"

import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { pricingTiers } from "@/content/site"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setPricingMode } from "@/store/slices/ui-slice"

export function PricingSection() {
  const pricingMode = useAppSelector((state) => state.ui.pricingMode)
  const dispatch = useAppDispatch()

  return (
    <section className="bg-[var(--contrazy-bg-muted)] py-20">
      <div className="mx-auto w-full max-w-7xl px-5 lg:px-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">
            Pricing
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Simple launch pricing with room to scale</h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
            Choose a plan that fits your launch stage now, with room to expand as workflow volume grows.
          </p>
          <div className="inline-flex gap-2 rounded-full border border-border bg-background p-1">
            <Button
              size="sm"
              variant={pricingMode === "monthly" ? "default" : "ghost"}
              className={pricingMode === "monthly" ? "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]" : ""}
              onClick={() => dispatch(setPricingMode("monthly"))}
            >
              Monthly
            </Button>
            <Button
              size="sm"
              variant={pricingMode === "yearly" ? "default" : "ghost"}
              className={pricingMode === "yearly" ? "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]" : ""}
              onClick={() => dispatch(setPricingMode("yearly"))}
            >
              Yearly
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-xl border bg-background p-8 shadow-sm ${
                tier.highlight ? "border-[var(--contrazy-teal)] ring-4 ring-[rgb(17_201_176/0.08)]" : "border-border"
              }`}
            >
              <p className="text-lg font-semibold text-foreground">{tier.name}</p>
              <p className="mt-2 text-sm text-muted-foreground">{tier.subtitle}</p>
              <p className="mt-6 text-4xl font-bold tracking-tight text-foreground">
                {pricingMode === "monthly" ? tier.monthly : tier.yearly}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pricingMode === "monthly" ? "per month" : "per year"}
              </p>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                {tier.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-[var(--contrazy-teal)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
