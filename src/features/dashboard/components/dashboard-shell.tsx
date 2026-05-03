"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  Activity,
  BadgeCheck,
  BookText,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
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
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AccountMenu } from "@/features/auth/components/account-menu"
import type { DashboardIconName, DashboardNavSection } from "@/features/dashboard/navigation"
import { getRoleProfilePath } from "@/lib/auth/pathing"
import type { UserRole } from "@/lib/auth/roles"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toast"

const dashboardIcons: Record<DashboardIconName, React.ComponentType<{ className?: string }>> = {
  activity: Activity,
  badgeCheck: BadgeCheck,
  bookText: BookText,
  briefcaseBusiness: BriefcaseBusiness,
  building2: Building2,
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
  account: {
    name: string | null
    email: string | null
    image: string | null
    role: UserRole | null
  }
  children: React.ReactNode
}

const DASHBOARD_SIDEBAR_STORAGE_KEY = "contrazy.dashboard.sidebar.collapsed"

export function DashboardShell({
  navigation,
  title,
  subtitle,
  actorLabel,
  account,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }

    return window.localStorage.getItem(DASHBOARD_SIDEBAR_STORAGE_KEY) === "1"
  })
  const desktopSidebarWidth = isSidebarCollapsed ? 92 : 264

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_SIDEBAR_STORAGE_KEY, isSidebarCollapsed ? "1" : "0")
  }, [isSidebarCollapsed])

  return (
    <div className="min-h-screen bg-(--contrazy-bg-muted)">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[linear-gradient(180deg,rgba(12,30,47,0.98),rgba(12,30,47,0.94))] text-white backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" />}>
                  <Menu className="size-4" />
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="gap-0 overflow-hidden border-r border-border bg-background p-0"
                >
                  <SheetHeader className="border-b border-border">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <DashboardSidebar navigation={navigation} pathname={pathname} collapsed={false} />
                </SheetContent>
              </Sheet>
            </div>
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              Con<span className="text-(--contrazy-teal)">trazy</span>
            </Link>
            <div className="hidden lg:block">
              <p className="text-xs text-white/45">{title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-white/10 bg-white/6 px-3 py-1 text-sm text-white/70 sm:block">
              {actorLabel}
            </div>
            <AccountMenu user={account} profileHref={getRoleProfilePath(account.role)} />
          </div>
        </div>
      </header>

      <div className="flex pt-14">
        <motion.aside
          initial={false}
          animate={{ width: desktopSidebarWidth }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-0 left-0 top-14 z-40 hidden border-r border-border bg-background/95 lg:block"
        >
          <DashboardSidebar
            navigation={navigation}
            pathname={pathname}
            collapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed((value) => !value)}
          />
        </motion.aside>
        <main
          className="min-w-0 flex-1 lg:ml-(--dashboard-sidebar-width) lg:transition-[margin-left] lg:duration-300 lg:ease-out"
          style={{ ["--dashboard-sidebar-width" as string]: `${desktopSidebarWidth}px` }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="px-4 py-6 sm:px-6 lg:px-8"
            >
              <div className="mb-6">
                <p className="text-xs font-semibold tracking-[0.2em] text-(--contrazy-teal) uppercase">{title}</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{subtitle}</h1>
              </div>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toaster />
    </div>
  )
}

function DashboardSidebar({
  navigation,
  pathname,
  collapsed,
  onToggle,
}: {
  navigation: DashboardNavSection[]
  pathname: string
  collapsed: boolean
  onToggle?: () => void
}) {
  return (
    <nav className="flex h-full min-h-0 flex-1 flex-col">
      <div className="border-b border-border/70 p-4">
        {onToggle ? (
          <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="px-3 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
                >
                  Workspace
                </motion.p>
              ) : null}
            </AnimatePresence>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="scrollbar-thin-subtle flex-1 overflow-y-auto p-4">
        <div className="space-y-5">
          {navigation.map((section) => (
            <div key={section.label}>
              <AnimatePresence initial={false}>
                {!collapsed ? (
                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    className="px-3 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
                  >
                    {section.label}
                  </motion.p>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mx-auto h-px w-8 bg-border"
                  />
                )}
              </AnimatePresence>
              <div className="mt-2 space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/vendor" && item.href !== "/admin" && pathname.startsWith(item.href))
                  const Icon = dashboardIcons[item.icon]

                  return (
                    <motion.div
                      key={item.href}
                      whileHover={{ x: collapsed ? 0 : 3 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        aria-label={item.label}
                        className={cn(
                          "flex items-center rounded-xl py-2.5 text-sm transition-all",
                          collapsed ? "justify-center px-0" : "gap-3 px-3",
                          isActive
                            ? "bg-(--contrazy-teal)/10 text-(--contrazy-teal) shadow-[inset_0_0_0_1px_rgba(17,201,176,0.12)]"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <AnimatePresence initial={false}>
                          {!collapsed ? (
                            <motion.span
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -8 }}
                            >
                              {item.label}
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </nav>
  )
}
