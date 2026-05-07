"use client"

import { FadeIn } from "@/components/ui/motion"
import { useTranslations } from "next-intl"

export function RegulatorySection() {
  const t = useTranslations("marketing.regulatory")
  const items = t.raw("items") as Array<{ label: string; detail: string }>

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

        <FadeIn delay={0.1} className="mt-12">
          <div className="rounded-[14px] border border-border border-l-[3px] border-l-amber-500 bg-background p-7">
            <h3 className="text-[15px] font-bold text-foreground">⚠️ {t("cardTitle")}</h3>
            <p className="mt-3 text-[14px] leading-[1.7] text-muted-foreground">
              {t("cardDescription")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.label} className="flex items-start gap-2 text-[13px] leading-[1.5] text-muted-foreground">
                  <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    <strong className="font-semibold text-foreground">{item.label}</strong> — {item.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
