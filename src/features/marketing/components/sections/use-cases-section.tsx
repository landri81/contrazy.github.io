"use client"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"

const cases = [
  { emoji: "🏠", title: "Location", desc: "Caution, contrat, identité." },
  { emoji: "🔧", title: "Prestations", desc: "Devis signé, acompte." },
  { emoji: "🚗", title: "Location de biens", desc: "Permis, selfie, garantie." },
  { emoji: "🏛️", title: "Collectivités", desc: "Salles, équipements." },
  { emoji: "🎉", title: "Événementiel", desc: "Arrhes, anti no-show." },
  { emoji: "💼", title: "B2B / Artisans", desc: "Facture, encaissement." },
  { emoji: "🏗️", title: "Matériel", desc: "Garantie, assurance." },
  { emoji: "📦", title: "Vente + acompte", desc: "Commande, solde." },
]

export function UseCasesSection() {
  return (
    <div className="bg-[var(--contrazy-bg-muted)]">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">Cas d&apos;usage</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            Pour toute activité <em className="italic text-[var(--contrazy-teal)]">qui encaisse</em>
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            Un moteur, des règles personnalisables par vendeur.
          </p>
        </FadeIn>

        <Stagger className="mt-12 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {cases.map((c) => (
            <StaggerItem
              key={c.title}
              className="rounded-[14px] border border-border bg-background px-4 py-6 text-center transition-all hover:-translate-y-0.5 hover:border-[var(--contrazy-teal)]/30"
            >
              <p className="text-[30px]">{c.emoji}</p>
              <h3 className="mt-2.5 text-[13px] font-bold text-foreground">{c.title}</h3>
              <p className="mt-1 text-[11px] leading-[1.4] text-muted-foreground">{c.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  )
}
