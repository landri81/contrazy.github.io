import type { Metadata } from "next"

import { legalDocuments } from "@/content/site"
import { ProseSections } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Imprint | Conntrazy",
  description: "Imprint and company information for the Conntrazy platform.",
}

export default function ImprintPage() {
  return (
    <PublicShell>
      <ProseSections
        eyebrow="Legal"
        title="Imprint"
        description="Review company identity and operational contact information for the platform."
        sections={legalDocuments.imprint}
      />
    </PublicShell>
  )
}
