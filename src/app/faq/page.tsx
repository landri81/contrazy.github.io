import type { Metadata } from "next"

import { FaqSectionFr } from "@/features/marketing/components/faq-section-fr"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "FAQ | Contrazy",
  description: "Tout ce que vous devez savoir avant de commencer avec Contrazy.",
}

export default function FaqPage() {
  return (
    <PublicShell>
      <FaqSectionFr />
    </PublicShell>
  )
}
