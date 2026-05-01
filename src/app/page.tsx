import { LandingPage } from "@/features/marketing/components/landing-page"
import { PublicShell } from "@/features/marketing/components/public-shell"

export default function HomePage() {
  return (
    <PublicShell>
      <LandingPage />
    </PublicShell>
  )
}
