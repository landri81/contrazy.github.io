import type { Metadata } from "next"

import { FeatureGrid, PageHero } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Demo | Conntrazy",
  description: "Preview the Conntrazy product experience and key workflow areas.",
}

export default function DemoPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Demo"
        title="Preview the Conntrazy product experience"
        description="Explore the main areas vendors, customers, and internal reviewers use throughout the workflow."
        primaryHref="/login"
        primaryLabel="Open the app"
      />
      <FeatureGrid
        eyebrow="Preview"
        title="What you can explore today"
        description="Each area below supports a different stage of the Conntrazy workflow."
        items={[
          {
            title: "Public pages",
            description: "Landing, pricing, help, status, legal information, and contact all live inside the same product experience.",
          },
          {
            title: "Vendor workspace",
            description: "Business setup, transactions, agreements, customer documents, payments, deposits, and activity all stay in one secure area.",
          },
          {
            title: "Admin oversight",
            description: "Internal reviewers can check user accounts, invites, access levels, and platform activity without mixing those tasks into vendor pages.",
          },
          {
            title: "Customer journey",
            description: "Customers move from secure link to profile, documents, agreement, signature, payment, and confirmation in one guided flow.",
          },
        ]}
      />
    </PublicShell>
  )
}
