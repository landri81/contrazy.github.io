"use client"

import Image from "next/image"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import { useCaseArtwork } from "@/features/marketing/section-artwork"
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
          {cases.map((c, i) => (
            <StaggerItem
              key={c.title}
              className="group rounded-[16px] border border-border bg-background p-4 text-center transition-all hover:-translate-y-0.5 hover:border-[var(--contrazy-teal)]/30 hover:shadow-[0_18px_38px_rgba(15,23,42,0.07)]"
            >
              <div className="rounded-[16px] border border-slate-200/80 bg-linear-to-br from-white to-[#eefaf7] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="relative mx-auto aspect-square max-w-[132px] overflow-hidden rounded-[12px]">
                  <Image
                    src={useCaseArtwork[i] ?? useCaseArtwork[useCaseArtwork.length - 1]}
                    alt={c.title}
                    fill
                    sizes="(min-width: 640px) 160px, 42vw"
                    className="object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                </div>
              </div>
              <h3 className="mt-3.5 text-[13px] font-bold text-foreground">{c.title}</h3>
              <p className="mt-1 text-[11px] leading-[1.45] text-muted-foreground">{c.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  )
}
