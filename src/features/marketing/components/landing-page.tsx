"use client"

import { HeroSection } from "@/features/marketing/components/sections/hero-section"
import { TrustBar } from "@/features/marketing/components/sections/trust-bar"
import { WorkflowSection } from "@/features/marketing/components/sections/workflow-section"
import { FeaturesSection } from "@/features/marketing/components/sections/features-section"
import { UseCasesSection } from "@/features/marketing/components/sections/use-cases-section"
import { VendorSection } from "@/features/marketing/components/sections/vendor-section"
import { RegulatorySection } from "@/features/marketing/components/sections/regulatory-section"
import { PricingSectionFr } from "@/features/marketing/components/sections/pricing-section-fr"
import { StackSection } from "@/features/marketing/components/sections/stack-section"
import { CtaSection } from "@/features/marketing/components/sections/cta-section"
import type { UserRole } from "@/lib/auth/roles"

export function LandingPage({ viewerRole = null }: { viewerRole?: UserRole | null }) {
  return (
    <>
      <HeroSection />
      <TrustBar />
      <WorkflowSection />
      <FeaturesSection />
      <UseCasesSection />
      <VendorSection />
      <RegulatorySection />
      <PricingSectionFr viewerRole={viewerRole} />
      <StackSection />
      <CtaSection />
    </>
  )
}
