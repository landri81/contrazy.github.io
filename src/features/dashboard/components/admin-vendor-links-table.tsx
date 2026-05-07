"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useTranslations } from "next-intl"

import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import type { AdminVendorLinksPageRecord } from "@/features/dashboard/server/dashboard-data"
import { useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

function buildPageWindow(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const result: (number | "...")[] = [1]

  if (current > 3) {
    result.push("...")
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let page = start; page <= end; page += 1) {
    result.push(page)
  }

  if (current < total - 2) {
    result.push("...")
  }

  result.push(total)
  return result
}

function TablePendingOverlay() {
  const t = useTranslations("dashboard.shared")

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-20 rounded-2xl border border-border/60 bg-background/76 backdrop-blur-[3px]"
    >
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <LoaderCircle className="size-4 animate-spin text-[var(--contrazy-teal)]" />
          {t("updatingResults")}
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="grid grid-cols-8 gap-4 border-b border-border px-4 py-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-3 rounded-full" />
            ))}
          </div>
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="grid grid-cols-8 gap-4 border-b border-border/70 px-4 py-4 last:border-b-0">
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="col-span-2 h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-11 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function AdminVendorLinksTable({
  userId,
  links,
}: {
  userId: string
  links: AdminVendorLinksPageRecord
}) {
  const t = useTranslations("dashboard.admin.vendorManager")
  const sharedT = useTranslations("dashboard.shared")
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const [pendingPage, setPendingPage] = useState<number | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)

  const start = links.totalCount > 0 ? (links.page - 1) * links.pageSize + 1 : 0
  const end = links.totalCount > 0 ? Math.min(links.page * links.pageSize, links.totalCount) : 0
  const pages = useMemo(() => buildPageWindow(links.page, links.totalPages), [links.page, links.totalPages])

  function navigateTo(target: string, options: { detailRowId?: string; page?: number; scroll?: boolean }) {
    setPendingRowId(options.detailRowId ?? null)
    setPendingPage(options.page ?? null)
    startTransition(() => {
      router.push(target, { scroll: options.scroll ?? false })
    })
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams({
      tab: "transactions",
      page: String(nextPage),
    })
    navigateTo(`/admin/users/${userId}?${params.toString()}`, {
      page: nextPage,
      scroll: false,
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative" aria-busy={isPending}>
        <motion.div
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: isPending ? 0.62 : 1,
                  scale: isPending ? 0.995 : 1,
                }
          }
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="space-y-4"
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/30">
                  <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-4 py-3 font-medium">{t("transactions.columns.reference")}</th>
                    <th className="px-4 py-3 font-medium">{t("transactions.columns.client")}</th>
                    <th className="px-4 py-3 font-medium">{t("transactions.columns.link")}</th>
                    <th className="px-4 py-3 font-medium">{t("transactions.columns.service")}</th>
                    <th className="px-4 py-3 font-medium">{t("transactions.columns.deposit")}</th>
                    <th className="px-4 py-3 font-medium">{t("transactions.columns.documents")}</th>
                    <th className="px-4 py-3 font-medium">{t("transactions.columns.lastActivity")}</th>
                    <th className="px-4 py-3 font-medium text-right">{t("transactions.columns.manage")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {links.records.map((record, index) => {
                    const href = `/admin/users/${userId}/links/${record.id}?page=${links.page}`
                    const rowPending = isPending && pendingRowId === record.id

                    return (
                      <motion.tr
                        key={record.id}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: reduceMotion ? 0 : index * 0.015 }}
                        className="transition-colors hover:bg-muted/20"
                      >
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-muted-foreground">{record.reference}</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{record.title}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <p className="font-medium text-foreground">{record.clientName ?? "—"}</p>
                          <p className="text-muted-foreground">{record.clientEmail ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <StatusBadge tone={getStatusTone(record.linkStatus)}>{record.linkStatus}</StatusBadge>
                            <StatusBadge tone={getStatusTone(record.transactionStatus)}>{record.transactionStatus}</StatusBadge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {record.amount == null ? "—" : new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: record.currency,
                            maximumFractionDigits: 2,
                          }).format(record.amount / 100)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {record.depositAmount == null ? "—" : new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: record.currency,
                            maximumFractionDigits: 2,
                          }).format(record.depositAmount / 100)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{record.documentCount}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{record.lastActivityAt}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              navigateTo(href, {
                                detailRowId: record.id,
                                scroll: true,
                              })
                            }}
                            disabled={isPending}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "cursor-pointer disabled:pointer-events-none disabled:opacity-70"
                            )}
                          >
                            {rowPending ? (
                              <>
                                <LoaderCircle className="size-3.5 animate-spin" />
                                {t("transactions.loading")}
                              </>
                            ) : (
                              t("transactions.manage")
                            )}
                          </button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {links.totalCount > links.pageSize ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {sharedT("showingResults", { start, end, total: links.totalCount })}
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToPage(links.page - 1)}
                  disabled={links.page <= 1 || isPending}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                  )}
                >
                  <ChevronLeft className="size-3.5" />
                  {sharedT("prev")}
                </button>

                {pages.map((page, index) =>
                  page === "..." ? (
                    <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      onClick={() => goToPage(page)}
                      disabled={page === links.page || isPending}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "min-w-[2rem] cursor-pointer disabled:opacity-60",
                        page === links.page &&
                          "pointer-events-none border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0] hover:text-white"
                        ,
                        isPending && pendingPage === page && "border-[var(--contrazy-teal)] text-[var(--contrazy-teal)]"
                      )}
                    >
                      {isPending && pendingPage === page ? <LoaderCircle className="size-3.5 animate-spin" /> : page}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => goToPage(links.page + 1)}
                  disabled={links.page >= links.totalPages || isPending}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                  )}
                >
                  {sharedT("next")}
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </motion.div>

        <AnimatePresence>{isPending ? <TablePendingOverlay /> : null}</AnimatePresence>
      </div>
    </div>
  )
}
