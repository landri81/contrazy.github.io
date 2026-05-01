import type { Metadata } from "next"

import { contactChannels } from "@/content/site"
import { ContactSection, PageHero } from "@/features/marketing/components/content-pages"
import { PublicShell } from "@/features/marketing/components/public-shell"

export const metadata: Metadata = {
  title: "Contact | Conntrazy",
  description: "Contact Conntrazy for support, sales, or partnership discussions.",
}

export default function ContactPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Contact"
        title="Talk through your workflow, pilot, or launch plan"
        description="Reach out for support, launch planning, or help shaping your customer workflow."
      />
      <ContactSection channels={contactChannels} />
    </PublicShell>
  )
}
