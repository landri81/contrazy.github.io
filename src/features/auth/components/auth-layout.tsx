"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowUpRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react"

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: React.ReactNode
}

const featurePoints = [
  { icon: ShieldCheck, label: "Business setup and approval in one place" },
  { icon: CheckCircle2, label: "Customer agreements, documents, and identity checks" },
  { icon: Sparkles, label: "Payments and deposits with clear follow-up steps" },
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
              Con<span className="text-[var(--contrazy-teal)]">trazy</span>
            </Link>
            
            <p className="max-w-sm text-3xl font-semibold leading-tight">
              Business onboarding, agreements, identity, and payments in one connected workspace.
            </p>
            <p className="max-w-sm text-sm leading-7 text-white/62">
              Open the account, complete review, launch client flows, and keep every operational step tied to the same transaction.
            </p>
          </div>

          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Platform focus</p>
                <p className="mt-2 text-sm font-medium text-white/85">Operational MVP with lower launch risk</p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/15 text-[var(--contrazy-teal)]">
                <ArrowUpRight className="size-4" />
              </span>
            </div>
            <ul className="space-y-4 text-sm text-white/75">
            {featurePoints.map(({ icon: Icon, label }, index) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.18 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-3"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--contrazy-teal)]/15 text-[var(--contrazy-teal)]">
                  <Icon className="size-3.5" />
                </span>
                <span>{label}</span>
              </motion.li>
            ))}
            </ul>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="relative text-xs text-white/45"
        >
          Secure sign-in for vendors, admins, and account owners
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
