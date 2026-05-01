import { SiteFooter } from "@/features/marketing/components/site-footer"
import { SiteHeader } from "@/features/marketing/components/site-header"

type PublicShellProps = {
  children: React.ReactNode
}

export function PublicShell({ children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}
