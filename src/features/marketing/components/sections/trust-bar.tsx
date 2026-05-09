"use client"

import { useTranslations } from "next-intl"

export function TrustBar() {
  const t = useTranslations("marketing.trustBar")
  const signals = t.raw("signals") as string[]

  // Doubling the signals ensures a seamless loop for the marquee
  const marqueeSignals = [...signals, ...signals, ...signals]

  return (
    <section className="border-y border-border/40 bg-background/50 py-4 backdrop-blur-sm">
      <div className="relative flex overflow-hidden">
        {/* Modern SaaS Gradient Fades (Left/Right) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

        <div className="animate-marquee flex flex-nowrap items-center gap-12 whitespace-nowrap">
          {marqueeSignals.map((signal, index) => (
            <div
              key={`${signal}-${index}`}
              className="flex items-center gap-3 text-sm font-medium tracking-tight text-muted-foreground/80 transition-colors hover:text-foreground"
            >
              {/* Subtle Dot or Icon instead of a number */}
              <div className="size-1.5 rounded-full bg-teal-500/50" />
              <span>{signal}</span>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  )
}
