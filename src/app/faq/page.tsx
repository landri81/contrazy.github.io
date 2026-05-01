import type { Metadata } from "next"

import { faqItems } from "@/content/site"
import { FaqPageSection, PageHero } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "FAQ | Conntrazy",
  description: "Frequently asked questions about the Conntrazy workflow platform.",
}

export default function FaqPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="FAQ"
        title="Answers before you start the workflow rollout"
        description="The most common questions before opening accounts and sending your first customer links."
      />
      <FaqPageSection
        title="Core product questions"
        description="Conntrazy is designed to keep the first release practical while still covering the key steps from setup to payment."
        items={faqItems}
      />
    </PublicShell>
  )
}
