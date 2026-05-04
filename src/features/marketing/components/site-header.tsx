"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react"
import { signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect } from "react"

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
  const closeMobileMenu = useCallback(() => {
    dispatch(setMobileMenuOpen(false))
  }, [dispatch])

  useEffect(() => {
    closeMobileMenu()
  }, [closeMobileMenu, pathname])

  useEffect(() => {
    if (!mobileMenuOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu()
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeMobileMenu, mobileMenuOpen])

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[color:rgb(12_30_47/96%)] text-white backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 lg:px-10">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            Con<span className="text-[var(--contrazy-teal)]">trazy</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
            {siteNav.filter((item) => !item.mobileOnly).map((item) => (
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
                  Se connecter
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-(--contrazy-teal) px-3 text-sm font-medium text-white transition-colors hover:bg-[#0eb8a0]"
                >
                  Essai gratuit 7j
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-0 top-16 bottom-0 z-40 px-3 pb-3 md:hidden"
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-[color:rgb(7_17_30/62%)] backdrop-blur-[3px]"
              onClick={closeMobileMenu}
            />

            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.985 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto flex max-h-[calc(100dvh-4rem-1rem)] w-full max-w-md flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,30,47,0.98),rgba(10,23,37,0.98))] shadow-[0_24px_80px_rgba(2,8,23,0.48)]"
              role="dialog"
              aria-modal="true"
            >
              <div className="border-b border-white/10 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Navigation
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    Explore Contrazy
                  </p>
                </div>
              </div>

              <div className="scrollbar-thin-subtle flex-1 overflow-y-auto px-3 py-3">
                <nav className="flex flex-col gap-1.5 text-sm text-white/72">
                  {siteNav.map((item, index) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.2, delay: index * 0.035 }}
                    >
                      <Link
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={`flex items-center justify-between rounded-2xl px-3.5 py-3 transition-colors ${
                          pathname === item.href
                            ? "bg-white/10 text-white"
                            : "hover:bg-white/7 hover:text-white"
                        }`}
                      >
                        <span>{item.label}</span>
                        <ArrowRight className="size-3.5 opacity-45" />
                      </Link>
                    </motion.div>
                  ))}
                </nav>

                <div className="mt-4 border-t border-white/10 pt-4">
                  {session?.user && homePath ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/6 px-3.5 py-3.5">
                        <Avatar size="default" className="size-10 after:border-white/10">
                          <AvatarImage src={session.user.image ?? undefined} alt={mobileLabel} />
                          <AvatarFallback className="bg-white/10 text-xs font-semibold text-white">
                            {mobileInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{mobileLabel}</p>
                          <p className="truncate text-xs text-white/55">{session.user.email ?? "Signed in"}</p>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Link
                          href={homePath}
                          onClick={closeMobileMenu}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-(--contrazy-teal) px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0eb8a0]"
                        >
                          <LayoutDashboard className="size-4" />
                          Mon espace
                        </Link>
                        {profilePath ? (
                          <Link
                            href={profilePath}
                            onClick={closeMobileMenu}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[0.02] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/8"
                          >
                            <UserRound className="size-4" />
                            Profile
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            closeMobileMenu()
                            void signOut({ callbackUrl: "/login" })
                          }}
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/14 bg-white/[0.02] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/8"
                        >
                          <LogOut className="size-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <Link
                        href="/register"
                        onClick={closeMobileMenu}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-(--contrazy-teal) px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0eb8a0]"
                      >
                        Essai gratuit 7j
                      </Link>
                      <Link
                        href="/login"
                        onClick={closeMobileMenu}
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-white/14 bg-white/[0.02] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/8"
                      >
                        Se connecter
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
