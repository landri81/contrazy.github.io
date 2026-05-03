"use client"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"

const features = [
  {
    emoji: "🪪",
    iconBg: "bg-[#E8FAF7]",
    title: "Vérification documentaire",
    desc: "Upload de pièces d'identité, permis, justificatifs. Le vendeur paramètre les documents exigés. KYC automatique disponible en option.",
    tag: "CONFIGURABLE",
    tagColor: "text-[var(--contrazy-teal)]",
    tagBg: "bg-[#E8FAF7]",
  },
  {
    emoji: "📝",
    iconBg: "bg-blue-500/[0.06]",
    title: "Contrats auto-générés",
    desc: "Le vendeur configure son modèle. Le moteur injecte les données du profil. PDF signable en 1 clic.",
    tag: "MOTEUR INTERNE",
    tagColor: "text-blue-500",
    tagBg: "bg-blue-500/[0.06]",
  },
  {
    emoji: "✍️",
    iconBg: "bg-green-500/[0.08]",
    title: "E-Signature électronique",
    desc: "Signature simple au sens eIDAS. Code OTP par SMS, horodatage, dossier de preuve archivé et téléchargeable.",
    tag: "SIGNATURE SIMPLE",
    tagColor: "text-green-600",
    tagBg: "bg-green-500/[0.08]",
  },
  {
    emoji: "💳",
    iconBg: "bg-amber-500/[0.06]",
    title: "Paiements & cautions",
    desc: "Paiement immédiat, acompte ou empreinte bancaire sans débit. Capture partielle ou totale.",
    tag: "STRIPE CONNECT",
    tagColor: "text-[var(--contrazy-teal)]",
    tagBg: "bg-[#E8FAF7]",
  },
  {
    emoji: "⚖️",
    iconBg: "bg-red-500/[0.06]",
    title: "Gestion des litiges",
    desc: "Retenue avec motif et preuves. Client notifié. Historique horodaté complet.",
    tag: "MOTEUR INTERNE",
    tagColor: "text-blue-500",
    tagBg: "bg-blue-500/[0.06]",
  },
  {
    emoji: "🔗",
    iconBg: "bg-[#E8FAF7]",
    title: "QR Codes dynamiques",
    desc: "Générez des QR codes modifiables pointant vers vos liens de transaction. Imprimables, traçables.",
    tag: "DIFFÉRENCIATEUR",
    tagColor: "text-[var(--contrazy-teal)]",
    tagBg: "bg-[#E8FAF7]",
  },
]

export function FeaturesSection() {
  return (
    <section className="bg-background px-5 py-24 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">Plateforme</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
            La couche <em className="italic text-[var(--contrazy-teal)]">confiance</em> qui manquait
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
            Chaque brique s&apos;appuie sur des partenaires certifiés.
          </p>
        </FadeIn>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <StaggerItem
              key={f.title}
              className="group rounded-[14px] border border-border bg-background p-7 transition-all hover:-translate-y-[3px] hover:border-[var(--contrazy-teal)]/30 hover:shadow-md"
            >
              <div className={`flex size-[46px] items-center justify-center rounded-xl text-[22px] ${f.iconBg}`}>
                {f.emoji}
              </div>
              <h3 className="mt-4 text-[15px] font-bold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted-foreground">{f.desc}</p>
              <span
                className={`mt-3 inline-block rounded px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.8px] ${f.tagColor} ${f.tagBg}`}
              >
                {f.tag}
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
