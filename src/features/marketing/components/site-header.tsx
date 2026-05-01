"use client"

import { Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { siteNav } from "@/content/site"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { setMobileMenuOpen } from "@/store/slices/ui-slice"

export function SiteHeader() {
  const dispatch = useAppDispatch()
  const pathname = usePathname()
  const mobileMenuOpen = useAppSelector((state) => state.ui.mobileMenuOpen)

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

      {mobileMenuOpen ? (
        <div className="sticky top-16 z-40 border-b border-white/10 bg-[var(--contrazy-navy)] px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-2 text-sm text-white/70">
            {siteNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 transition-colors hover:bg-white/8 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2">
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
            </div>
          </nav>
        </div>
      ) : null}
    </>
  )
}
