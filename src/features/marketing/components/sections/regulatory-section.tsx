"use client"

import { FadeIn } from "@/components/ui/motion"

const items = [
  { label: "Pas de séquestre", detail: "Empreinte bancaire. Aucune détention de fonds." },
  { label: "Caution = pré-autorisation", detail: "Jusqu'à 7 jours selon la banque du client." },
  { label: "Signature simple eIDAS", detail: "OTP SMS + horodatage + dossier de preuve." },
  { label: "RGPD", detail: "Stockage chiffré, durée limitée." },
  { label: "3D Secure / DSP2", detail: "Authentification forte selon les règles Stripe." },
  { label: "Stripe Connect", detail: "Comptes connectés. Flux conformes." },
]

export function RegulatorySection() {
  return (
    <div className="bg-[var(--contrazy-bg-muted)]">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">Cadre juridique</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            Conçu pour être <em className="italic text-[var(--contrazy-teal)]">conforme</em>
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            Architecture sans besoin d&apos;agrément ACPR.
          </p>
        </FadeIn>

        <FadeIn delay={0.1} className="mt-12">
          <div className="rounded-[14px] border border-border border-l-[3px] border-l-amber-500 bg-background p-7">
            <h3 className="text-[15px] font-bold text-foreground">⚠️ Architecture réglementaire</h3>
            <p className="mt-3 text-[14px] leading-[1.7] text-muted-foreground">
              Contrazy ne détient jamais de fonds pour le compte de tiers. La plateforme orchestre des pré-autorisations Stripe avec capture différée.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.label} className="flex items-start gap-2 text-[13px] leading-[1.5] text-muted-foreground">
                  <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>
                    <strong className="font-semibold text-foreground">{item.label}</strong> — {item.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
