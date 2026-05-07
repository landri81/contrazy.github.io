"use client"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import { useTranslations } from "next-intl"

export function WorkflowSection() {
  const t = useTranslations("marketing.workflow")
  const steps = t.raw("steps") as Array<{ n: string; emoji: string; title: string; desc: string }>

  return (
    <div className="bg-[var(--contrazy-bg-muted)]">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">{t("eyebrow")}</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            {t("titleBefore")} <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em>{t("titleAfter")}
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            {t("description")}
          </p>
        </FadeIn>

        <Stagger className="mt-12 grid grid-cols-3 overflow-hidden rounded-[20px] border border-border shadow-lg lg:grid-cols-6">
          {steps.map((step, i) => (
            <StaggerItem
              key={step.n}
              className={`bg-background px-4 py-8 text-center transition-colors hover:bg-[#E8FAF7] ${
                i < steps.length - 1 ? "border-r border-border" : ""
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-[var(--contrazy-teal)]">{step.n}</p>
              <p className="mt-3 text-[26px]">{step.emoji}</p>
              <h4 className="mt-3 text-xs font-bold text-foreground">{step.title}</h4>
              <p className="mt-1 text-[11px] leading-[1.4] text-muted-foreground">{step.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  )
}
