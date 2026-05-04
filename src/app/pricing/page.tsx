import type { Metadata } from "next"

import { PageHero, ProseSections } from "@/features/marketing/components/content-pages"
import { PricingSectionFr } from "@/features/marketing/components/sections/pricing-section-fr"
import { PublicShell } from "@/features/marketing/components/public-shell"
import { resolveMarketingPlanHref } from "@/features/subscriptions/config"
import { getAuthSession } from "@/lib/auth/session"

export const metadata: Metadata = {
  title: "Tarifs | Contrazy",
  description: "Abonnement simple + extras à l'usage. 0 % de commission sur les paiements.",
}

export default async function PricingPage() {
  const session = await getAuthSession()
  const viewerRole = session?.user?.role ?? null

  return (
    <PublicShell>
      <PageHero
        eyebrow="Tarifs"
        title="0 % de commission sur les paiements"
        description="Abonnement simple + extras à l'usage. Les frais de paiement sont supportés par le vendeur via son compte Stripe."
        primaryHref={resolveMarketingPlanHref(viewerRole, "pro")}
        primaryLabel="Essai gratuit 7 jours"
      />
      <PricingSectionFr viewerRole={viewerRole} />
      <ProseSections
        eyebrow="Modèle"
        title="Modèle commercial"
        description="Contrazy est conçu pour rester simple au lancement tout en offrant une trajectoire claire vers la croissance."
        sections={[
          {
            title: "Abonnements plateforme",
            paragraphs: [
              "Les plans Starter, Pro et Business donnent accès à la plateforme avec des quotas inclus de transactions, vérifications KYC et e-signatures.",
              "Le plan Enterprise est sur devis car les déploiements à fort volume impliquent des besoins en support et conformité spécifiques.",
            ],
          },
          {
            title: "Frais transactionnels",
            paragraphs: [
              "Les frais de traitement des paiements et des cautions restent distincts de l'abonnement Contrazy.",
              "Contrazy facilite la gestion du flux autour de ces paiements — la plateforme ne détient jamais de fonds pour compte de tiers.",
            ],
          },
        ]}
      />
    </PublicShell>
  )
}
