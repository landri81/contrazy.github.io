"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Menu, X } from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { siteNav } from "@/content/site"
import { AccountMenu } from "@/features/auth/components/account-menu"
import { getRoleHomePath, getRoleProfilePath } from "@/lib/auth/pathing"
import type { PublicHeaderSession } from "@/features/marketing/components/public-shell"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setMobileMenuOpen } from "@/store/slices/ui-slice"

export function SiteHeader({ session }: { session: PublicHeaderSession }) {
  const dispatch = useAppDispatch()
  const pathname = usePathname()
  const mobileMenuOpen = useAppSelector((state) => state.ui.mobileMenuOpen)
  const homePath = session?.user?.role ? getRoleHomePath(session.user.role) : null
  const profilePath = session?.user?.role ? getRoleProfilePath(session.user.role) : null
  const mobileLabel = session?.user?.name?.trim() || session?.user?.email?.split("@")[0] || "Account"
  const mobileInitials = mobileLabel.slice(0, 2).toUpperCase()

  useEffect(() => {
    dispatch(setMobileMenuOpen(false))
  }, [dispatch, pathname])

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[color:rgb(12_30_47/96%)] text-white backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 lg:px-10">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            Con<span className="text-[var(--contrazy-teal)]">trazy</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            {siteNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors hover:text-white ${pathname === item.href ? "text-white" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {session?.user && homePath ? (
              <AccountMenu user={session.user} workspaceHref={homePath} profileHref={profilePath} />
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--contrazy-teal)] px-3 text-sm font-medium text-white transition-colors hover:bg-[#0eb8a0]"
                >
                  Start
                </Link>
              </>
            )}
          </div>

          <Button
            aria-label="Toggle menu"
            size="icon-sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white md:hidden"
            onClick={() => dispatch(setMobileMenuOpen(!mobileMenuOpen))}
          >
            {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {mobileMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="sticky top-16 z-40 border-b border-white/10 bg-[var(--contrazy-navy)] px-5 py-4 md:hidden"
          >
            <nav className="flex flex-col gap-2 text-sm text-white/70">
              {siteNav.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2, delay: index * 0.04 }}
                >
                  <Link
                    href={item.href}
                    className="rounded-md px-3 py-2 transition-colors hover:bg-white/8 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <div className="mt-2 grid gap-2">
                {session?.user && homePath ? (
                  <>
                    <div className="flex items-center gap-3 rounded-xl border border-white/12 bg-white/6 px-3 py-3">
                      <Avatar size="default" className="size-9 after:border-white/10">
                        <AvatarImage src={session.user.image ?? undefined} alt={mobileLabel} />
                        <AvatarFallback className="bg-white/10 text-xs font-semibold text-white">
                          {mobileInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{mobileLabel}</p>
                        <p className="truncate text-xs text-white/60">{session.user.email ?? "Signed in"}</p>
                      </div>
                    </div>
                    <Link
                      href={homePath}
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--contrazy-teal)] px-3 text-sm font-medium text-white transition-colors hover:bg-[#0eb8a0]"
                    >
                      Workspace
                    </Link>
                    {profilePath ? (
                      <Link
                        href={profilePath}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-white/20 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                      >
                        Profile
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/login" })}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-white/20 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-white/20 px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/register"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--contrazy-teal)] px-3 text-sm font-medium text-white transition-colors hover:bg-[#0eb8a0]"
                    >
                      Start
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
