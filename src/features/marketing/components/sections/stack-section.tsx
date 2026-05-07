"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"

export function StackSection() {
  const t = useTranslations("marketing.stack")
  const cards = t.raw("cards") as Array<{ src: string; alt: string; title: string; desc: string }>

  return (
    <div className="bg-[var(--contrazy-navy)]">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">{t("eyebrow")}</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-white">
            {t("titleBefore")} <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em>
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-white/50">
            {t("description")}
          </p>
        </FadeIn>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <StaggerItem
              key={card.title}
              className="rounded-[14px] border border-white/[0.06] bg-[var(--contrazy-navy-soft)] p-6 transition-colors hover:border-[var(--contrazy-teal)]/25"
            >
              <div className="mb-3.5 overflow-hidden rounded-lg bg-white/[0.06] p-3">
                <Image
                  src={card.src}
                  alt={card.alt}
                  width={400}
                  height={120}
                  className="h-[120px] w-full rounded object-contain"
                />
              </div>
              <h3 className="text-[14px] font-bold text-white">{card.title}</h3>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-white/45">{card.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  )
}
