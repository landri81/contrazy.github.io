import type { Metadata } from "next"

import { statusCards } from "@/content/site"
import { PageHero } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Status | Conntrazy",
  description: "Current platform status for Conntrazy services and customer operations.",
}

export default function StatusPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Status"
        title="Current platform status"
        description="See the latest view of sign-in, payments, document handling, and delivery health."
      />
      <section className="px-5 py-20 lg:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-4 lg:grid-cols-2">
          {statusCards.map((card) => (
            <div key={card.title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold tracking-[0.18em] text-[var(--contrazy-teal)] uppercase">
                {card.tag}
              </p>
              <h2 className="mt-3 text-lg font-semibold text-foreground">{card.title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.description}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  )
}
