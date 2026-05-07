"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { LoaderCircle } from "lucide-react"
import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type AdminVendorTabRecord = {
  key: string
  label: string
  href: string
}

function TabContentPendingOverlay() {
  const t = useTranslations("dashboard.admin.vendorManager.tabs")

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-20 rounded-2xl border border-border/60 bg-background/78 backdrop-blur-[4px]"
    >
      <div className="flex h-full min-h-[20rem] flex-col gap-4 p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <LoaderCircle className="size-4 animate-spin text-[var(--contrazy-teal)]" />
          {t("loading")}
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm">
            <Skeleton className="h-6 w-40 rounded-full" />
            <Skeleton className="h-4 w-64 rounded-full" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-18 rounded-2xl" />
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm">
            <Skeleton className="h-6 w-32 rounded-full" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function AdminVendorTabShell({
  tabs,
  activeTab,
  children,
}: {
  tabs: AdminVendorTabRecord[]
  activeTab: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  function handleTabChange(tab: AdminVendorTabRecord) {
    if (tab.key === activeTab || isPending) {
      return
    }

    setPendingTab(tab.key)
    startTransition(() => {
      router.push(tab.href, { scroll: false })
    })
  }

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2 border-b border-border pb-2" aria-label="Vendor manager sections">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key
          const isTabPending = isPending && pendingTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab)}
              disabled={isPending}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-default disabled:pointer-events-none disabled:opacity-80",
                isActive || isTabPending
                  ? "border-(--contrazy-teal) bg-(--contrazy-teal)/8 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-(--contrazy-teal)/40 hover:text-foreground"
              )}
            >
              {isTabPending ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div className="relative" aria-busy={isPending}>
        <motion.div
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: isPending ? 0.58 : 1,
                  y: isPending ? 4 : 0,
                  scale: isPending ? 0.996 : 1,
                }
          }
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="space-y-6"
        >
          {children}
        </motion.div>

        <AnimatePresence>{isPending ? <TabContentPendingOverlay /> : null}</AnimatePresence>
      </div>
    </div>
  )
}
