"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import { stackArtwork } from "@/features/marketing/section-artwork"

export function StackSection() {
  const t = useTranslations("marketing.stack")
  const cards = t.raw("cards") as Array<{
    src: string
    alt: string
    title: string
    desc: string
  }>

  return (
    <section className="relative overflow-hidden bg-[var(--contrazy-navy)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(17,201,176,0.10),transparent_45%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.04),transparent_40%)]" />

      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
        <FadeIn className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--contrazy-teal)]">
            {t("eyebrow")}
          </p>

          <h2 className="font-heading mt-4 text-[36px] font-bold leading-[1.1] tracking-[-0.04em] text-white sm:text-[44px] lg:text-[56px]">
            {t("titleBefore")}{" "}
            <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em>
          </h2>

          <p className="mt-4 max-w-[560px] text-[15px] leading-[1.8] text-white/60 sm:text-[16px]">
            {t("description")}
          </p>
        </FadeIn>

        <Stagger className="mt-14 grid-cols-2 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, i) => (
            <StaggerItem
              key={card.title}
              className="group relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--contrazy-teal)]/25"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--contrazy-teal)]/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute -right-10 -top-10 size-28 rounded-full bg-[var(--contrazy-teal)]/10 blur-3xl transition-all duration-300 group-hover:bg-[var(--contrazy-teal)]/15" />

              <div className="relative mb-5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[radial-gradient(circle_at_top,rgba(17,201,176,0.12),transparent_60%)] p-4">
                <Image
                  src={stackArtwork[i] ?? stackArtwork[stackArtwork.length - 1]}
                  alt={card.alt}
                  width={420}
                  height={180}
                  className="h-[140px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                />
              </div>

              <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-white">
                {card.title}
              </h3>

              <p className="mt-2 text-[13.5px] leading-[1.7] text-white/55">
                {card.desc}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}