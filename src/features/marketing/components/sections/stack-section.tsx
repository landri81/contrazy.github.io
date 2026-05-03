"use client"

import Image from "next/image"

import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"

const cards = [
  { src: "/images/img-connect.jpg", alt: "Stripe Connect", title: "Stripe Connect", desc: "Flux vendeur/client. Comptes connectés." },
  { src: "/images/img-identity.jpg", alt: "Stripe Identity", title: "Stripe Identity", desc: "Vérification documents + selfie. Disponible en option (plans Pro+)." },
  { src: "/images/img-billing.jpg", alt: "Stripe Billing", title: "Stripe Billing", desc: "Abonnements vendeurs automatiques." },
  { src: "/images/img-auth.jpg", alt: "Auth Capture", title: "Auth + Capture", desc: "Empreinte CB sans débit. Capture différée." },
  { src: "/images/img-webhooks.jpg", alt: "Webhooks", title: "Webhooks", desc: "Notifications temps réel." },
  { src: "/images/img-postgres.jpg", alt: "PostgreSQL", title: "Next.js + PostgreSQL", desc: "Front performant, API robuste." },
]

export function StackSection() {
  return (
    <div className="bg-[var(--contrazy-navy)]">
      <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">
        <FadeIn className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">Stack technique</p>
          <h2 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-white">
            Construit sur <em className="italic text-[var(--contrazy-teal)]">Stripe</em>
          </h2>
          <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-white/50">
            La plateforme exploite l&apos;écosystème Stripe pour se concentrer sur la couche métier.
          </p>
        </FadeIn>

        <Stagger className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <StaggerItem
              key={card.title}
              className="rounded-[14px] border border-white/[0.06] bg-[var(--contrazy-navy-soft)] p-6 transition-colors hover:border-[var(--contrazy-teal)]/25"
            >
              <div className="mb-3.5 overflow-hidden rounded-lg bg-white/[0.06] p-3">
                <Image
                  src={card.src}
                  alt={card.alt}
                  width={400}
                  height={120}
                  className="h-[120px] w-full rounded object-contain"
                />
              </div>
              <h3 className="text-[14px] font-bold text-white">{card.title}</h3>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-white/45">{card.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  )
}
