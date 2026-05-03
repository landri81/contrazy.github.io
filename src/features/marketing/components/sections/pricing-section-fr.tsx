"use client"

import { useState } from "react"
import Link from "next/link"

import { FadeIn } from "@/components/ui/motion"

const tiers = [
  {
    name: "Starter",
    subtitle: "Indépendants · 1 utilisateur",
    monthly: 9,
    items: [
      "10 transactions / mois",
      "10 e-signatures / mois",
      "2 QR Codes",
      "1 modèle de contrat",
      "Envoi par email",
      "Pas de KYC",
    ],
    cta: "Commencer",
    ctaStyle: "border border-border bg-background text-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)]",
    href: "/register",
  },
  {
    name: "Pro",
    subtitle: "Loueurs · Prestataires",
    monthly: 24,
    items: [
      "Transactions illimitées",
      "E-Signatures illimitées",
      "10 vérifications KYC / mois",
      "Contrats auto-générés",
      "SMS + WhatsApp (10/mois)",
      "QR Codes illimités",
      "Profils clients persistants",
    ],
    cta: "Essai gratuit 7 jours",
    ctaStyle: "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
    href: "/register",
  },
  {
    name: "Business",
    subtitle: "Gestionnaires · Équipes",
    monthly: 49,
    highlight: true,
    badge: "Recommandé",
    items: [
      "Tout Pro +",
      "25 vérifications KYC / mois",
      "Contrats illimités",
      "SMS + WhatsApp (25/mois)",
      "Workflow litiges",
      "3 utilisateurs",
    ],
    cta: "Essai gratuit 7 jours",
    ctaStyle: "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
    href: "/register",
  },
  {
    name: "Enterprise",
    subtitle: "API · Marque blanche",
    monthly: null,
    items: [
      "Tout Business +",
      "API REST + webhooks",
      "Marque blanche complète",
      "KYC illimité",
      "Utilisateurs illimités",
      "SLA + support dédié",
    ],
    cta: "Nous contacter",
    ctaStyle: "border border-border bg-background text-foreground hover:border-[var(--contrazy-teal)] hover:text-[var(--contrazy-teal)]",
    href: "/contact",
  },
]

export function PricingSectionFr() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="tarifs" className="bg-background px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">Tarifs</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            <em className="italic text-[var(--contrazy-teal)]">0 % de commission</em> sur les paiements
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            Abonnement simple + extras à l&apos;usage. Les frais de paiement sont supportés par le vendeur via son compte Stripe.
          </p>
        </FadeIn>

        {/* Toggle */}
        <div className="mt-10 flex items-center justify-center gap-3 text-sm font-semibold text-muted-foreground">
          <span className={annual ? "text-muted-foreground" : "font-bold text-foreground"}>Mensuel</span>
          <button
            type="button"
            onClick={() => setAnnual(!annual)}
            className="relative h-7 w-[52px] rounded-full transition-colors"
            style={{ background: annual ? "var(--contrazy-teal)" : "#CBD5E1" }}
            aria-label="Toggle annual pricing"
          >
            <span
              className="absolute top-[3px] size-[22px] rounded-full bg-white shadow-sm transition-transform"
              style={{ left: 3, transform: annual ? "translateX(24px)" : "translateX(0)" }}
            />
          </button>
          <span className={annual ? "font-bold text-foreground" : "text-muted-foreground"}>Annuel</span>
          <span className="rounded-full bg-[#E8FAF7] px-2.5 py-0.5 text-[11px] font-bold text-[var(--contrazy-teal)]">
            -15%
          </span>
        </div>

        {/* Pricing grid */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => {
            const annualTotal = tier.monthly ? Math.round(tier.monthly * 12 * 0.85) : null
            const annualMonthly = annualTotal ? Math.round(annualTotal / 12) : null

            return (
              <div
                key={tier.name}
                className={`relative rounded-[20px] p-9 transition-all hover:-translate-y-1 hover:shadow-xl ${
                  tier.highlight
                    ? "border-2 border-[var(--contrazy-teal)] shadow-[0_0_0_4px_rgba(17,201,176,0.08)]"
                    : "border border-border"
                } bg-background`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--contrazy-teal)] px-4 py-1 text-[11px] font-bold text-white whitespace-nowrap">
                    {tier.badge}
                  </span>
                )}

                <p className="text-[18px] font-bold text-foreground">{tier.name}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{tier.subtitle}</p>

                <div className="mt-6">
                  {tier.monthly ? (
                    <>
                      <div className="flex items-baseline gap-1">
                        {annual && (
                          <span className="text-[20px] font-semibold text-muted-foreground/50 line-through">
                            {tier.monthly * 12}€
                          </span>
                        )}
                        <span className="text-[42px] font-extrabold tracking-tight text-foreground">
                          {annual ? annualTotal : tier.monthly}€
                        </span>
                        <span className="text-[15px] text-muted-foreground">HT</span>
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        {annual
                          ? `/ an · soit ${annualMonthly}€/mois`
                          : "/ mois · sans engagement"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[42px] font-extrabold tracking-tight text-foreground">Sur devis</p>
                      <p className="text-[12px] text-muted-foreground">facturation annuelle</p>
                    </>
                  )}
                </div>

                <p className="mt-7 text-[11px] font-bold uppercase tracking-[1.5px] text-muted-foreground">
                  {tier.name === "Starter" ? "Inclus" : `Tout ${tiers[tiers.indexOf(tier) - 1]?.name ?? ""} +`}
                </p>
                <ul className="mt-3 space-y-[5px]">
                  {tier.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                      <span className="mt-[3px] font-bold text-[var(--contrazy-teal)]">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.href}
                  className={`mt-6 flex h-10 w-full items-center justify-center rounded-lg text-[13px] font-semibold transition-all ${tier.ctaStyle}`}
                >
                  {tier.cta}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Transaction fees note */}
        <FadeIn delay={0.1} className="mt-8">
          <div className="rounded-[14px] border border-border border-l-[3px] border-l-[var(--contrazy-teal)] bg-background p-7">
            <h3 className="text-[15px] font-bold text-foreground">💳 Frais transactionnels (payés par le vendeur)</h3>
            <p className="mt-2 text-[14px] leading-[1.7] text-muted-foreground">
              <strong className="text-foreground">Caution libérée (non retenue)</strong> :{" "}
              <span className="font-bold text-green-600">0 €</span> · Aucun frais pour le vendeur ni le client
              <br />
              <strong className="text-foreground">Caution capturée (retenue totale ou partielle)</strong> :{" "}
              <span className="font-semibold">2 % + 0,25 €</span> du montant retenu · Frais de service Contrazy + frais Stripe (1,5 % + 0,25 €)
              <br />
              <strong className="text-foreground">Paiement encaissé</strong> : frais Stripe standards (1,5 % + 0,25 €) · Prélevé directement par Stripe
              <br />
              <strong className="text-foreground">KYC supplémentaire</strong> : 1,50 € (Starter) · 1 € (Pro/Business) par vérification au-delà du quota
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
