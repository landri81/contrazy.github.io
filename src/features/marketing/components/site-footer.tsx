"use client"

import { motion } from "framer-motion"
import Link from "next/link"

import { footerGroups } from "@/content/site"

export function SiteFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="border-t border-border bg-background"
    >
      {/* Main grid */}
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-[60px] lg:grid-cols-[2fr_1fr_1fr_1fr] lg:px-10">
        {/* Brand column */}
        <div>
          <Link href="/" className="text-[22px] font-extrabold tracking-tight text-foreground">
            Con<span className="text-[var(--contrazy-teal)]">trazy</span>
          </Link>
          <p className="mt-3.5 max-w-[280px] text-[14px] leading-[1.7] text-muted-foreground">
            La plateforme qui centralise contrat, KYC, e-signature, caution et paiement en un seul lien ou QR code sécurisé.
          </p>
        </div>

        {/* Link columns */}
        {footerGroups.map((group) => (
          <div key={group.title}>
            <h4 className="text-[13px] font-bold text-foreground">{group.title}</h4>
            <ul className="mt-3.5 space-y-[3px]">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-[3px] text-[13px] text-muted-foreground transition-colors hover:text-[var(--contrazy-teal)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Copyright bar */}
      <div className="mx-auto max-w-7xl border-t border-border px-5 pb-10 pt-6 lg:px-10">
        <p className="text-center text-[12px] leading-[1.8] text-muted-foreground/70">
          © 2026 Contrazy SAS · Plateforme de sécurisation transactionnelle · Propulsé par Stripe Connect &amp; Identity
          <br />
          Aucune détention de fonds pour compte de tiers · Tous droits réservés
        </p>
      </div>
    </motion.footer>
  )
}
