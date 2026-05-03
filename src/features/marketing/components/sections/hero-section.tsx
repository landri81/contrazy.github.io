"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion"

const stats = [
  { value: "0 %", label: "Commission caution" },
  { value: "< 3 min", label: "Dossier complet" },
  { value: "120+", label: "Pays couverts KYC" },
  { value: "SES", label: "Signature simple eIDAS" },
]

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[var(--contrazy-navy)] px-5 pb-24 pt-[140px] text-white lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[200px] -top-[200px] size-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(17,201,176,.08), transparent 70%)" }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-20 lg:grid-cols-2 lg:items-center">
        <FadeIn>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--contrazy-teal)]/20 bg-[var(--contrazy-teal)]/10 px-3.5 py-1.5 text-xs font-semibold text-[var(--contrazy-teal)]">
            <motion.span
              className="size-1.5 rounded-full bg-[var(--contrazy-teal)]"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            Plateforme transactionnelle sécurisée
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-heading text-[44px] font-bold leading-[1.15] tracking-[-1px] text-white"
          >
            Contrat, KYC, signature, caution et paiement —{" "}
            <em className="text-[var(--contrazy-teal)]">en un seul lien</em>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-[480px] text-[17px] leading-[1.75] text-white/55"
          >
            Envoyez un lien ou un QR code à votre client. Il crée son profil, ses pièces sont vérifiées, le contrat se génère, il signe et il paie. Tout en un.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link
              href="/register"
              className={buttonVariants({
                className: "group h-12 bg-[var(--contrazy-teal)] px-7 text-white hover:bg-[#0eb8a0]",
              })}
            >
              Essai gratuit 7 jours
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </FadeIn>

        <Stagger className="mt-10 grid grid-cols-2 gap-4 lg:mt-0">
          {stats.map((stat) => (
            <StaggerItem
              key={stat.label}
              className="rounded-[14px] border border-white/[0.06] bg-white/[0.04] p-6 transition-colors hover:border-[var(--contrazy-teal)]/20 hover:bg-white/[0.06]"
            >
              <p className="text-[28px] font-extrabold leading-none text-white">{stat.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{stat.label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
