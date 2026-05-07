"use client"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import { useTranslations } from "next-intl"

export function UseCasesSection() {
  const t = useTranslations("marketing.useCases")
  const cases = t.raw("items") as Array<{ emoji: string; title: string; desc: string }>

  return (
    <div className="bg-[var(--contrazy-bg-muted)]">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">{t("eyebrow")}</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            {t("titleBefore")} <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em>
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            {t("description")}
          </p>
        </FadeIn>

        <Stagger className="mt-12 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {cases.map((c) => (
            <StaggerItem
              key={c.title}
              className="rounded-[14px] border border-border bg-background px-4 py-6 text-center transition-all hover:-translate-y-0.5 hover:border-[var(--contrazy-teal)]/30"
            >
              <p className="text-[30px]">{c.emoji}</p>
              <h3 className="mt-2.5 text-[13px] font-bold text-foreground">{c.title}</h3>
              <p className="mt-1 text-[11px] leading-[1.4] text-muted-foreground">{c.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  )
}
