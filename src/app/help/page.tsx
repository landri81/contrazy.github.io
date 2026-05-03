import type { Metadata } from "next"
import Link from "next/link"

import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Centre d'aide | Contrazy",
  description: "Retrouvez toutes les réponses à vos questions.",
}

export default function HelpPage() {
  return (
    <PublicShell>
      <div className="min-h-screen bg-[var(--contrazy-bg-muted)]">
        <div className="mx-auto max-w-7xl px-5 py-24 lg:px-10">

          {/* Page header */}
          <div className="mb-12 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[3px] text-[var(--contrazy-teal)]">Support</p>
            <h1 className="font-heading mt-3.5 text-[34px] font-bold leading-[1.2] tracking-[-0.5px] text-foreground">
              Centre <em className="italic text-[var(--contrazy-teal)]">d&apos;aide</em>
            </h1>
            <p className="mt-3.5 max-w-[480px] text-[15px] leading-[1.7] text-muted-foreground">
              Retrouvez toutes les réponses à vos questions.
            </p>
          </div>

          {/* Content */}
          <div className="max-w-[800px] space-y-10">

            <div>
              <h2 className="text-[20px] font-bold leading-snug text-foreground">Comment démarrer ?</h2>
              <ol className="mt-5 space-y-3">
                {[
                  "Créez votre compte Contrazy (essai gratuit 7 jours).",
                  "Connectez votre compte Stripe via notre assistant.",
                  "Configurez vos modèles de contrat et vos checklists documentaires.",
                  "Générez votre premier lien ou QR code de transaction.",
                  "Envoyez-le par SMS, email ou WhatsApp à votre client.",
                ].map((step, i) => (
                  <li key={step} className="flex gap-4">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--contrazy-teal)]/10 text-[12px] font-bold text-[var(--contrazy-teal)]">
                      {i + 1}
                    </span>
                    <p className="text-[15px] leading-[1.7] text-muted-foreground">{step}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[14px] border border-border bg-background p-7">
              <h2 className="text-[20px] font-bold leading-snug text-foreground">
                Besoin d&apos;aide supplémentaire ?
              </h2>
              <p className="mt-4 text-[15px] leading-[1.7] text-muted-foreground">
                Notre équipe est disponible par email à{" "}
                <Link
                  href="mailto:support@contrazy.com"
                  className="font-semibold text-[var(--contrazy-teal)] hover:underline"
                >
                  support@contrazy.com
                </Link>{" "}
                ou via le chat en ligne du lundi au vendredi de 9h à 18h.
              </p>
            </div>

          </div>
        </div>
      </div>
    </PublicShell>
  )
}
