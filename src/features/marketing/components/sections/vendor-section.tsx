"use client"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"

const cards = [
  {
    emoji: "📄",
    iconBg: "bg-blue-500/[0.06]",
    title: "Modèles de contrat",
    desc: "Variables dynamiques : nom, dates, montants. PDF auto-généré à la volée.",
  },
  {
    emoji: "✅",
    iconBg: "bg-green-500/[0.08]",
    title: "Checklist documentaire",
    desc: "Pièces exigées par type : identité, permis, selfie, attestation, justificatif sur mesure.",
  },
  {
    emoji: "⚙️",
    iconBg: "bg-amber-500/[0.06]",
    title: "Règles de garantie",
    desc: "Montant, durée de blocage, conditions de retenue, relances automatiques.",
  },
]

export function VendorSection() {
  return (
    <section className="bg-background px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">Côté vendeur</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            Vous <em className="italic text-[var(--contrazy-teal)]">configurez</em>, Contrazy{" "}
            <em className="italic text-[var(--contrazy-teal)]">exécute</em>
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            Chaque vendeur paramètre ses propres règles.
          </p>
        </FadeIn>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <StaggerItem
              key={card.title}
              className="rounded-[14px] border border-border bg-background p-7 transition-all hover:-translate-y-[3px] hover:border-[var(--contrazy-teal)]/30 hover:shadow-md"
            >
              <div className={`flex size-[46px] items-center justify-center rounded-xl text-[22px] ${card.iconBg}`}>
                {card.emoji}
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-foreground">{card.title}</h3>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">{card.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
