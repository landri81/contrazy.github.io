import type { Metadata } from "next"

import { apiSections } from "@/content/site"
import { PageHero, ProseSections } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Platform Guide | Conntrazy",
  description: "An overview of how Conntrazy handles setup, reviews, customer flows, and payments.",
}

export default function ApiDocsPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Guide"
        title="How Conntrazy works"
        description="A simple guide to the main account, review, customer, and payment flows inside the platform."
      />
      <ProseSections
        eyebrow="Overview"
        title="Core platform flows"
        description="Use this guide to understand how vendors get started, how reviews work, and how customer journeys move forward."
        sections={apiSections}
      />
    </PublicShell>
  )
}
