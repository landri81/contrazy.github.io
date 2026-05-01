import type { Metadata } from "next"

import { legalDocuments } from "@/content/site"
import { ProseSections } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Privacy | Conntrazy",
  description: "Privacy information for the Conntrazy platform.",
}

export default function PrivacyPage() {
  return (
    <PublicShell>
      <ProseSections
        eyebrow="Legal"
        title="Privacy policy"
        description="Review how Conntrazy handles account information, workflow records, and supporting data."
        sections={legalDocuments.privacy}
      />
    </PublicShell>
  )
}
