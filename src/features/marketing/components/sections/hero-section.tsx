"use client"

import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import { Stagger, StaggerItem } from "@/components/ui/motion"

export function HeroSection() {
  const t = useTranslations("marketing.hero")
  const stats = t.raw("stats") as Array<{ value: string; label: string }>

  return (
    <section className="relative overflow-hidden bg-[var(--contrazy-navy)] px-5 pb-24 pt-[140px] text-white lg:px-10">
      {/* Background Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[200px] -top-[200px] size-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(17,201,176,.08), transparent 70%)" }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-20 lg:grid-cols-2 lg:items-center">
        {/* Static Content Side */}
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--contrazy-teal)]/20 bg-[var(--contrazy-teal)]/10 px-3.5 py-1.5 text-xs font-semibold text-[var(--contrazy-teal)]">
            <span className="size-1.5 rounded-full bg-[var(--contrazy-teal)]" />
            {t("eyebrow")}
          </div>

          <h1 className="font-heading text-[44px] font-bold leading-[1.15] tracking-[-1px] text-white">
            {t("titleBefore")}{" "}
            <em className="text-[var(--contrazy-teal)]">{t("titleEmphasis")}</em>
          </h1>

          <p className="mt-6 max-w-[480px] text-[17px] leading-[1.75] text-white/55">
            {t("description")}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/register"
              className={buttonVariants({
                className: "group h-12 bg-[var(--contrazy-teal)] px-7 text-white hover:bg-[#0eb8a0]",
              })}
            >
              {t("cta")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Animated Cards Side */}
        <Stagger className="mt-10 grid grid-cols-2 gap-4 lg:mt-0">
          {stats.map((stat) => (
            <StaggerItem
              key={stat.label}
              className="rounded-[14px] border border-white/[0.06] bg-white/[0.04] p-6 transition-colors hover:border-[var(--contrazy-teal)]/20 hover:bg-white/[0.06]"
            >
              <p className="text-[28px] font-extrabold leading-none text-white">
                {stat.value}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">
                {stat.label}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}