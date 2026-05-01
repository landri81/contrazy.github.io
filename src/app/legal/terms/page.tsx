import type { Metadata } from "next"

import { legalDocuments } from "@/content/site"
import { ProseSections } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Terms | Conntrazy",
  description: "Terms of service for the Conntrazy platform.",
}

export default function TermsPage() {
  return (
    <PublicShell>
      <ProseSections
        eyebrow="Legal"
        title="Terms of service"
        description="Review the core terms that apply to account use, customer workflows, and payment handling."
        sections={legalDocuments.terms}
      />
    </PublicShell>
  )
}
