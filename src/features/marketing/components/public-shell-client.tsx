"use client"

import { AnimatePresence, motion } from "framer-motion"
import { usePathname } from "next/navigation"

import type { PublicHeaderSession } from "@/features/marketing/components/public-shell"
import { SiteFooter } from "@/features/marketing/components/site-footer"
import { SiteHeader } from "@/features/marketing/components/site-header"

type PublicShellClientProps = {
  children: React.ReactNode
  session: PublicHeaderSession
}

export function PublicShellClient({ children, session }: PublicShellClientProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader session={session} />
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <SiteFooter />
    </div>
  )
}
