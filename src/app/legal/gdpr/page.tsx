import type { Metadata } from "next"

import { legalDocuments } from "@/content/site"
import { ProseSections } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "GDPR | Conntrazy",
  description: "GDPR information for the Conntrazy platform.",
}

export default function GdprPage() {
  return (
    <PublicShell>
      <ProseSections
        eyebrow="Legal"
        title="GDPR information"
        description="Review the main data rights and retention principles used across the platform."
        sections={legalDocuments.gdpr}
      />
    </PublicShell>
  )
}
