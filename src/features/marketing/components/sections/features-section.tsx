"use client"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import { useTranslations } from "next-intl"

export function FeaturesSection() {
  const t = useTranslations("marketing.features")
  const features = t.raw("items") as Array<{
    emoji: string
    iconBg: string
    title: string
    desc: string
    tag: string
    tagColor: string
    tagBg: string
  }>

  return (
    <section className="bg-background px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">{t("eyebrow")}</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            {t("titleBefore")} <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em>{t("titleAfter")}
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            {t("description")}
          </p>
        </FadeIn>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem
              key={f.title}
              className="group rounded-[14px] border border-border bg-background p-7 transition-all hover:-translate-y-[3px] hover:border-[var(--contrazy-teal)]/30 hover:shadow-md"
            >
              <div className={`flex size-[46px] items-center justify-center rounded-xl text-[22px] ${f.iconBg}`}>
                {f.emoji}
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">{f.desc}</p>
              <span
                className={`mt-3 inline-block rounded px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.8px] ${f.tagColor} ${f.tagBg}`}
              >
                {f.tag}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
