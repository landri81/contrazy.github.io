import type { Metadata } from "next"

import { PageHero, ProseSections } from "@/features/marketing/components/content-pages"
import { PricingSection } from "@/features/marketing/components/pricing-section"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Pricing | Conntrazy",
  description: "Simple launch pricing for Conntrazy with room to scale as usage grows.",
}

export default function PricingPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Pricing"
        title="Launch pricing that matches the Conntrazy scope"
        description="Start with a plan that fits your current launch stage and grow as workflow volume increases."
        primaryHref="/register"
        primaryLabel="Create vendor account"
      />
      <PricingSection />
      <ProseSections
        eyebrow="Model"
        title="Commercial model"
        description="Conntrazy is designed to stay practical at launch while giving teams a clear path to growth."
        sections={[
          {
            title: "Platform subscriptions",
            paragraphs: [
              "Starter and Growth pricing focus on platform access, workflow setup, and operational dashboards.",
              "Enterprise pricing remains custom because higher-volume deployments will shape support and compliance scope differently.",
            ],
          },
          {
            title: "Operational fees",
            paragraphs: [
              "Payment processing and deposit authorization fees stay separate from the Conntrazy subscription.",
              "Conntrazy focuses on helping teams manage the workflow around those payments, not on holding funds itself.",
            ],
          },
        ]}
      />
    </PublicShell>
  )
}
