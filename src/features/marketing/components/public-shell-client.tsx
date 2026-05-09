"use client"
import type { PublicHeaderSession } from "@/features/marketing/components/public-shell"
import { SiteFooter } from "@/features/marketing/components/site-footer"
import { SiteHeader } from "@/features/marketing/components/site-header"

type PublicShellClientProps = {
  children: React.ReactNode
  session: PublicHeaderSession
}

export function PublicShellClient({ children, session }: PublicShellClientProps) {

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader session={session} />
      
          {children}
        
      <SiteFooter />
    </div>
  )
}
