"use client"

import type { UserRole } from "@/lib/auth/roles"

import { FadeIn } from "@/components/ui/motion"
import { SubscriptionPricingGrid } from "@/features/subscriptions/components/subscription-pricing-grid"

export function PricingSectionFr({ viewerRole = null }: { viewerRole?: UserRole | null }) {
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

        <div className="mt-10">
          <SubscriptionPricingGrid mode="marketing" viewerRole={viewerRole} />
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
