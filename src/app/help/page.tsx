import type { Metadata } from "next"

import { helpSections } from "@/content/site"
import { PageHero, ProseSections } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Help | Conntrazy",
  description: "Help center for Conntrazy onboarding, transactions, and operations.",
}

export default function HelpPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Help"
        title="Operational help for vendors and admins"
        description="Find the main guidance for account setup, customer journeys, and internal review."
      />
      <ProseSections
        eyebrow="Guides"
        title="Core help topics"
        description="Start here for the core steps teams follow during setup and daily use."
        sections={helpSections}
      />
    </PublicShell>
  )
}
