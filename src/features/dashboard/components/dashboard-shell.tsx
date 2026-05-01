"use client"

import {
  Activity,
  BadgeCheck,
  BookText,
  BriefcaseBusiness,
  CreditCard,
  FileClock,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Link2,
  Logs,
  Mail,
  MapPinned,
  Menu,
  ReceiptText,
  ScrollText,
  Shield,
  Signature,
  Users,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { DashboardIconName, DashboardNavSection } from "@/features/dashboard/navigation"
import { SignOutButton } from "@/features/auth/components/sign-out-button"
import { cn } from "@/lib/utils"

const dashboardIcons: Record<DashboardIconName, React.ComponentType<{ className?: string }>> = {
  activity: Activity,
  badgeCheck: BadgeCheck,
  bookText: BookText,
  briefcaseBusiness: BriefcaseBusiness,
  creditCard: CreditCard,
  fileClock: FileClock,
  fileText: FileText,
  folderKanban: FolderKanban,
  layoutDashboard: LayoutDashboard,
  link2: Link2,
  logs: Logs,
  mail: Mail,
  mapPinned: MapPinned,
  receiptText: ReceiptText,
  scrollText: ScrollText,
  shield: Shield,
  signature: Signature,
  users: Users,
  wallet: Wallet,
}

type DashboardShellProps = {
  navigation: DashboardNavSection[]
  title: string
  subtitle: string
  actorLabel: string
  children: React.ReactNode
}

export function DashboardShell({
  navigation,
  title,
  subtitle,
  actorLabel,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[var(--contrazy-bg-muted)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[var(--contrazy-navy)] text-white">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" />}>
                  <Menu className="size-4" />
                </SheetTrigger>
                <SheetContent side="left" className="border-r border-border bg-background p-0">
                  <SheetHeader className="border-b border-border">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <DashboardSidebar navigation={navigation} pathname={pathname} />
                </SheetContent>
              </Sheet>
            </div>
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              Con<span className="text-[var(--contrazy-teal)]">trazy</span>
            </Link>
            <div className="hidden lg:block">
              <p className="text-xs text-white/45">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-white/60 sm:block">{actorLabel}</p>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="flex pt-14">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-background lg:block">
          <DashboardSidebar navigation={navigation} pathname={pathname} />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6">
              <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">{title}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{subtitle}</h1>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function DashboardSidebar({
  navigation,
  pathname,
}: {
  navigation: DashboardNavSection[]
  pathname: string
}) {
  return (
    <nav className="space-y-5 p-4">
      {navigation.map((section) => (
        <div key={section.label}>
          <p className="px-3 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {section.label}
          </p>
          <div className="mt-2 space-y-1">
            {section.items.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/vendor" && item.href !== "/admin" && pathname.startsWith(item.href))
              const Icon = dashboardIcons[item.icon]

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
