import { getAuthSession } from "@/lib/auth/session"
import { LandingPage } from "@/features/marketing/components/landing-page"
import { PublicShell } from "@/features/marketing/components/public-shell"

export default async function HomePage() {
  const session = await getAuthSession()

  return (
    <PublicShell>
      <LandingPage viewerRole={session?.user?.role ?? null} />
    </PublicShell>
  )
}
