"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

const faqItems = [
  {
    q: "Contrazy, c'est quoi ?",
    a: "Contrazy est une plateforme de sécurisation transactionnelle qui centralise contrat, KYC (vérification d'identité), e-signature électronique, caution et paiement en un seul lien ou QR code. Vos clients n'ont pas besoin de créer de compte.",
  },
  {
    q: "Contrazy s'adresse à qui ?",
    a: "Aux loueurs (courte durée, véhicules, matériel), prestataires de services, artisans, collectivités, organisateurs d'événements, et toute entreprise ayant besoin de sécuriser une transaction avec contrat, identité et/ou garantie financière.",
  },
  {
    q: "Contrazy collecte-t-il mes fonds ?",
    a: "Non. Contrazy ne détient jamais de fonds pour le compte de tiers. Les flux financiers transitent directement entre votre client et votre compte Stripe Connect. Contrazy orchestre la pré-autorisation et la capture, mais ne touche pas à l'argent.",
  },
  {
    q: "Comment fonctionne la caution ?",
    a: "La caution est une empreinte bancaire via pré-autorisation Stripe. Le montant est bloqué sur la carte de votre client sans être débité, généralement jusqu'à 7 jours selon la banque émettrice. En cas de dégradation, vous pouvez capturer tout ou partie du montant depuis votre tableau de bord. Sans action de votre part, l'autorisation est automatiquement libérée.",
  },
  {
    q: "Qu'est-ce que la e-signature Contrazy ?",
    a: "Contrazy propose une signature électronique simple au sens du règlement eIDAS. Votre client signe le contrat généré automatiquement via un code OTP envoyé par SMS. Un dossier de preuve horodaté (hash du document, IP, user-agent, code OTP) est archivé pour chaque signature. Ce niveau convient aux contrats de location, devis, bons de commande et CGV.",
  },
  {
    q: "Mon client doit-il créer un compte ?",
    a: "Non. Votre client reçoit un lien (par SMS, email, WhatsApp) ou scanne un QR code. Il remplit son profil, uploade ses pièces, signe le contrat et paie — tout ça sans créer de compte Contrazy.",
  },
  {
    q: "Comment fonctionne la vérification d'identité (KYC) ?",
    a: "Contrazy utilise Stripe Identity pour vérifier automatiquement les pièces d'identité de vos clients. Le vendeur paramètre les pièces exigées (CNI, passeport, permis, selfie). L'IA vérifie l'authenticité du document et la correspondance faciale en quelques secondes. Plus de 120 pays sont couverts.",
  },
  {
    q: "Puis-je utiliser des QR codes ?",
    a: "Oui. Vous pouvez générer des QR codes dynamiques pointant vers vos liens de transaction. Imprimez-les sur vos supports (flyers, comptoir, email de confirmation) et modifiez leur contenu à tout moment sans réimprimer le code.",
  },
  {
    q: "Quels sont les modes de paiement acceptés ?",
    a: "Toutes les cartes bancaires (Visa, Mastercard, AMEX) via Stripe. Les paiements sont protégés par l'authentification forte 3D Secure conforme à la directive DSP2.",
  },
  {
    q: "Suis-je protégé contre les fraudes ?",
    a: "Oui. Chaque transaction exige le code 3D Secure envoyé par la banque du client. En cas d'opposition à la carte après versement d'une caution, le client devra fournir les justificatifs à sa banque. Vous êtes protégé contre les contestations pour fraude.",
  },
  {
    q: "Comment fonctionne la facturation Contrazy ?",
    a: "Contrazy fonctionne par abonnement mensuel ou annuel (-15%). L'abonnement donne accès à la plateforme avec un quota inclus de transactions, vérifications KYC et e-signatures. Les extras (SMS, vérifications supplémentaires) sont facturés à l'usage.",
  },
  {
    q: "Quelles sont les obligations RGPD ?",
    a: "Contrazy est conforme au RGPD. Les pièces d'identité sont stockées de manière chiffrée avec une durée de conservation limitée. Le consentement explicite du client est requis avant tout traitement de données personnelles. Vous pouvez consulter notre politique de confidentialité pour plus de détails.",
  },
]

export function FaqSectionFr() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggleItem = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index))
  }

  return (
    <div className="min-h-screen bg-[var(--contrazy-bg-muted)]">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
        {/* Page header */}
        <div className="mb-12 max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">FAQ</p>
          <h1 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            Foire aux <em className="italic text-[var(--contrazy-teal)]">questions</em>
          </h1>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            Tout ce que vous devez savoir avant de commencer.
          </p>
        </div>

        {/* Accordion */}
        <div className="max-w-3xl space-y-2">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <motion.div
                key={item.q}
                layout
                className="cursor-pointer overflow-hidden rounded-[12px] border bg-background"
                initial={false}
                animate={{
                  borderColor: isOpen ? "rgba(17,201,176,0.38)" : "rgba(15,23,42,0.08)",
                  boxShadow: isOpen
                    ? "0 20px 44px rgba(15, 23, 42, 0.08)"
                    : "0 10px 24px rgba(15, 23, 42, 0.04)",
                  y: isOpen ? -2 : 0,
                }}
                whileHover={{
                  borderColor: "rgba(17,201,176,0.26)",
                  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
                  y: -2,
                }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                onMouseEnter={() => setOpenIndex(index)}
                onMouseLeave={() => setOpenIndex((current) => (current === index ? null : current))}
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between px-6 py-[18px] text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--contrazy-teal)]/35 focus-visible:ring-offset-2"
                  onClick={() => toggleItem(index)}
                  onFocus={() => setOpenIndex(index)}
                >
                  <span
                    className={`text-[15px] font-semibold transition-colors ${
                      isOpen ? "text-[var(--contrazy-teal)]" : "text-foreground"
                    }`}
                  >
                    {item.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    className={`ml-4 shrink-0 cursor-pointer transition-colors ${
                      isOpen ? "text-[var(--contrazy-teal)]" : "text-muted-foreground"
                    }`}
                  >
                    <ChevronDown className="size-4" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-[14px] leading-[1.75] text-muted-foreground">
                        {item.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
