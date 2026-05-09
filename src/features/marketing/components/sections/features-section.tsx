"use client"

import Image from "next/image"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"
import { featureArtwork } from "@/features/marketing/section-artwork"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

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
    <section className="relative bg-background py-24 lg:py-32 overflow-hidden">
      {/* Decorative background element for SaaS feel */}
      <div className="absolute top-0 left-1/4 size-[500px] bg-teal-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container relative mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <FadeIn className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-px w-5 bg-teal-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-600">
                {t("eyebrow")}
              </p>
            </div>
            <h2 className="text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
              {t("titleBefore")}{" "}
              <span className="italic font-serif text-teal-600">{t("titleEmphasis")}</span>
              {t("titleAfter")}
            </h2>
          </FadeIn>

          <FadeIn delay={0.1} className="hidden lg:block">
            <p className="max-w-[380px] text-sm leading-relaxed text-muted-foreground border-l border-border pl-6">
              {t("description")}
            </p>
          </FadeIn>
        </div>

        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <StaggerItem
              key={f.title}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-border/60 bg-card/50 p-8",
                "transition-all duration-500 hover:-translate-y-1 hover:border-teal-500/30 hover:bg-white dark:hover:bg-zinc-900/40",
                "hover:shadow-[0_20px_50px_rgba(20,184,166,0.05)]"
              )}
            >
              {/* Card Spotlight Effect */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--x,50%)_var(--y,50%),rgba(20,184,166,0.08)_0%,transparent_100%)] opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  {/* Icon Container */}
                  <div className={cn(
                    "flex size-14 items-center justify-center rounded-2xl ring-1 ring-border shadow-sm transition-all duration-500 group-hover:shadow-teal-500/10",
                    f.iconBg
                  )}>
                    <Image
                      src={featureArtwork[i] ?? featureArtwork[featureArtwork.length - 1]}
                      alt={f.title}
                      width={32}
                      height={32}
                      className="object-contain transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>

                  {/* Status Tag */}
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors",
                    f.tagColor, f.tagBg,
                    "border border-white/10"
                  )}>
                    {f.tag}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-teal-600">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground/80">
                  {f.desc}
                </p>
              </div>

              
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}