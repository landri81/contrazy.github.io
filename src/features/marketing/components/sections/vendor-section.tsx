"use client"

import Image from "next/image"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import { vendorArtwork } from "@/features/marketing/section-artwork"
import { useTranslations } from "next-intl"

export function VendorSection() {
  const t = useTranslations("marketing.vendor")
  const cards = t.raw("cards") as Array<{
    emoji: string
    iconBg: string
    title: string
    desc: string
  }>

  return (
    <section className="relative overflow-hidden bg-background px-5 py-24 lg:px-10">
      <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.10),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_28%),linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)]" />
      <div className="mx-auto max-w-7xl">
        <FadeIn className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--contrazy-teal)]">
            {t("eyebrow")}
          </p>

          <h2 className="font-heading mt-4 text-[36px] font-bold leading-[1.1] tracking-[-0.04em] text-foreground sm:text-[44px] lg:text-[56px]">
            {t("titleBefore")}{" "}
            <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasisOne")}</em>,{" "}
            {t("titleMiddle")}{" "}
            <em className="italic text-[var(--contrazy-teal)]">{t("titleEmphasisTwo")}</em>
          </h2>

          <p className="mt-4 max-w-[560px] text-[15px] leading-[1.8] text-muted-foreground sm:text-[16px]">
            {t("description")}
          </p>
        </FadeIn>

        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card, i) => (
            <StaggerItem
              key={card.title}
              className="group relative overflow-hidden rounded-[22px] border border-border/60 bg-card/70 p-6 shadow-[0_1px_0_rgba(255,255,255,0.04),0_18px_40px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--contrazy-teal)]/25 hover:shadow-[0_20px_60px_rgba(0,0,0,0.08)]"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--contrazy-teal)]/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute -right-10 -top-10 size-28 rounded-full bg-[var(--contrazy-teal)]/8 blur-3xl transition-all duration-300 group-hover:bg-[var(--contrazy-teal)]/12" />

              <div className="relative">
                <div
                  className={`flex size-14 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-black/5 ${card.iconBg} shadow-sm`}
                >
                  <Image
                    src={vendorArtwork[i] ?? vendorArtwork[vendorArtwork.length - 1]}
                    alt={card.title}
                    width={34}
                    height={34}
                    sizes="34px"
                    className="h-[34px] w-[34px] object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-foreground">
                  {card.title}
                </h3>

                <p className="mt-2 text-[13.5px] leading-[1.7] text-muted-foreground">
                  {card.desc}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}