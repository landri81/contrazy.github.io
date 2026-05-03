"use client"

import Link from "next/link"
import { motion } from "framer-motion"


type AuthLayoutProps = {
  title: string
  subtitle: string
  children: React.ReactNode
}

const featurePoints = [
  { emoji: "🪪", label: "Vérification d'identité automatique" },
  { emoji: "📝", label: "Contrats auto-générés et signés" },
  { emoji: "💳", label: "Cautions et paiements sécurisés" },
  { emoji: "📱", label: "QR Codes dynamiques" },
]

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-[var(--contrazy-bg-muted)] lg:grid-cols-[500px_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-white/10 bg-[linear-gradient(165deg,#081727_0%,#0c1e2f_48%,#132d46_100%)] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-[var(--contrazy-teal)]/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full bg-[var(--contrazy-teal)]/10 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative space-y-10"
        >
          <div className="space-y-5">
            <Link href="/" className="inline-flex items-center text-2xl font-extrabold tracking-tight">
              Con<span className="text-(--contrazy-teal)">trazy</span>
            </Link>

            <p className="max-w-sm text-[26px] font-semibold leading-tight">
              Sécurisez toute la transaction, pas seulement le paiement.
            </p>
            <p className="max-w-sm text-[14px] leading-[1.75] text-white/62">
              Contrat, KYC, e-signature, caution et paiement — en un seul lien ou QR code.
            </p>
          </div>

          <ul className="space-y-3">
            {featurePoints.map(({ emoji, label }, index) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.18 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[18px]">
                  {emoji}
                </span>
                <span className="text-[14px] text-white/80">{label}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="relative text-xs text-white/45"
        >
          Connexion sécurisée pour vendeurs, administrateurs et propriétaires de compte
        </motion.p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg"
        >
          <div className="rounded-[28px] border border-border/70 bg-background/88 p-6 shadow-[0_30px_80px_-40px_rgba(12,30,47,0.3)] backdrop-blur xl:p-8">
            <div className="mb-6 text-center">
              <Link href="/" className="inline-flex items-center text-[22px] font-extrabold tracking-tight text-foreground">
                Con<span className="text-(--contrazy-teal)">trazy</span>
              </Link>
              <h1 className="mt-2 text-[22px] font-bold tracking-tight text-foreground">{title}</h1>
              <p className="mt-1 text-[13px] leading-[1.6] text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
