"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  Search,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import { StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import type { AdminVendorLinksPageRecord } from "@/features/dashboard/server/dashboard-data"
import { useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type LinkQueryDraft = {
  q: string
  linkStatus: string
  transactionStatus: string
  kind: string
}

type AdminVendorLinksApiResponse = {
  success: boolean
  message?: string
  links?: AdminVendorLinksPageRecord
}

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

function toDraftFilters(filters: AdminVendorLinksPageRecord["filters"]): LinkQueryDraft {
  return {
    q: filters.q,
    linkStatus: filters.linkStatus ?? "",
    transactionStatus: filters.transactionStatus ?? "",
    kind: filters.kind ?? "",
  }
}

function normalizeDraftFilters(filters: LinkQueryDraft): LinkQueryDraft {
  return {
    q: filters.q.trim(),
    linkStatus: filters.linkStatus.trim(),
    transactionStatus: filters.transactionStatus.trim(),
    kind: filters.kind.trim(),
  }
}

function hasActiveFilters(filters: LinkQueryDraft) {
  return Boolean(filters.q || filters.linkStatus || filters.transactionStatus || filters.kind)
}

function areDraftFiltersEqual(left: LinkQueryDraft, right: LinkQueryDraft) {
  return (
    left.q === right.q &&
    left.linkStatus === right.linkStatus &&
    left.transactionStatus === right.transactionStatus &&
    left.kind === right.kind
  )
}

function buildAdminTransactionsQueryParams(filters: LinkQueryDraft, page: number) {
  const params = new URLSearchParams({ tab: "transactions" })

  if (page > 1) {
    params.set("page", String(page))
  }

  if (filters.q) {
    params.set("q", filters.q)
  }

  if (filters.linkStatus) {
    params.set("linkStatus", filters.linkStatus)
  }

  if (filters.transactionStatus) {
    params.set("transactionStatus", filters.transactionStatus)
  }

  if (filters.kind) {
    params.set("kind", filters.kind)
  }

  return params
}

function formatMoney(cents: number | null, currency: string, locale: string) {
  if (cents == null) {
    return "—"
  }

  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
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
  const locale = useLocale()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [isNavigating, startNavigation] = useTransition()
  const [tableLinks, setTableLinks] = useState(links)
  const [draftFilters, setDraftFilters] = useState<LinkQueryDraft>(() => toDraftFilters(links.filters))
  const [appliedFilters, setAppliedFilters] = useState<LinkQueryDraft>(() => toDraftFilters(links.filters))
  const [isLoading, setIsLoading] = useState(false)
  const [pendingPage, setPendingPage] = useState<number | null>(null)
  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    []
  )

  const isBusy = isLoading || isNavigating
  const start = tableLinks.totalCount > 0 ? (tableLinks.page - 1) * tableLinks.pageSize + 1 : 0
  const end =
    tableLinks.totalCount > 0
      ? Math.min(tableLinks.page * tableLinks.pageSize, tableLinks.totalCount)
      : 0
  const pages = useMemo(
    () => buildPageWindow(tableLinks.page, tableLinks.totalPages),
    [tableLinks.page, tableLinks.totalPages]
  )

  const linkStatusOptions = useMemo(
    () => [
      { value: "ACTIVE", label: t("transactions.filterOptions.linkStatus.ACTIVE") },
      { value: "PROCESSING", label: t("transactions.filterOptions.linkStatus.PROCESSING") },
      { value: "COMPLETED", label: t("transactions.filterOptions.linkStatus.COMPLETED") },
      { value: "CANCELLED", label: t("transactions.filterOptions.linkStatus.CANCELLED") },
    ],
    [t]
  )

  const transactionStatusOptions = useMemo(
    () => [
      { value: "DRAFT", label: t("transactions.filterOptions.transactionStatus.DRAFT") },
      { value: "LINK_SENT", label: t("transactions.filterOptions.transactionStatus.LINK_SENT") },
      {
        value: "CUSTOMER_STARTED",
        label: t("transactions.filterOptions.transactionStatus.CUSTOMER_STARTED"),
      },
      {
        value: "DOCS_SUBMITTED",
        label: t("transactions.filterOptions.transactionStatus.DOCS_SUBMITTED"),
      },
      {
        value: "KYC_VERIFIED",
        label: t("transactions.filterOptions.transactionStatus.KYC_VERIFIED"),
      },
      {
        value: "CONTRACT_GENERATED",
        label: t("transactions.filterOptions.transactionStatus.CONTRACT_GENERATED"),
      },
      { value: "SIGNED", label: t("transactions.filterOptions.transactionStatus.SIGNED") },
      {
        value: "PAYMENT_AUTHORIZED",
        label: t("transactions.filterOptions.transactionStatus.PAYMENT_AUTHORIZED"),
      },
      { value: "COMPLETED", label: t("transactions.filterOptions.transactionStatus.COMPLETED") },
      { value: "CANCELLED", label: t("transactions.filterOptions.transactionStatus.CANCELLED") },
      { value: "DISPUTED", label: t("transactions.filterOptions.transactionStatus.DISPUTED") },
    ],
    [t]
  )

  const kindOptions = useMemo(
    () => [
      { value: "PAYMENT", label: t("transactions.filterOptions.kind.PAYMENT") },
      { value: "DEPOSIT", label: t("transactions.filterOptions.kind.DEPOSIT") },
      { value: "HYBRID", label: t("transactions.filterOptions.kind.HYBRID") },
    ],
    [t]
  )

  const linkStatusLabels = useMemo(
    () => Object.fromEntries(linkStatusOptions.map((option) => [option.value, option.label])),
    [linkStatusOptions]
  )
  const transactionStatusLabels = useMemo(
    () => Object.fromEntries(transactionStatusOptions.map((option) => [option.value, option.label])),
    [transactionStatusOptions]
  )
  const localeLabels = useMemo(
    (): Record<string, string> => ({
      en: t("transactions.filterOptions.locale.en"),
      fr: t("transactions.filterOptions.locale.fr"),
    }),
    [t]
  )

  function syncUrl(filters: LinkQueryDraft, page: number) {
    const params = buildAdminTransactionsQueryParams(filters, page)
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`)
  }

  async function loadLinks(
    nextFilters: LinkQueryDraft,
    nextPage: number,
    options: { synchronizeDraft?: boolean } = {}
  ) {
    const normalizedFilters = normalizeDraftFilters(nextFilters)

    if (nextPage === tableLinks.page && areDraftFiltersEqual(normalizedFilters, appliedFilters)) {
      if (options.synchronizeDraft) {
        setDraftFilters(normalizedFilters)
      }
      syncUrl(normalizedFilters, nextPage)
      return
    }

    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setPendingPage(nextPage !== tableLinks.page ? nextPage : null)
    setPendingRowId(null)

    try {
      const apiParams = buildAdminTransactionsQueryParams(normalizedFilters, nextPage)
      apiParams.delete("tab")

      const response = await fetch(`/api/admin/users/${userId}/links?${apiParams.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      })

      const payload = (await response.json()) as AdminVendorLinksApiResponse

      if (!response.ok || !payload.success || !payload.links) {
        throw new Error(payload.message ?? t("transactions.errors.requestFailed"))
      }

      const nextAppliedFilters = toDraftFilters(payload.links.filters)

      setTableLinks(payload.links)
      setAppliedFilters(nextAppliedFilters)

      if (options.synchronizeDraft) {
        setDraftFilters(nextAppliedFilters)
      }

      syncUrl(nextAppliedFilters, payload.links.page)
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }

      toast({
        variant: "error",
        title: t("transactions.errors.loadTitle"),
        description:
          error instanceof Error && error.message.length > 0
            ? error.message
            : t("transactions.errors.requestFailed"),
      })
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
        setPendingPage(null)
      }

      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }

  function updateDraftFilter(field: keyof LinkQueryDraft, value: string) {
    setDraftFilters((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleApply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void loadLinks(draftFilters, 1, { synchronizeDraft: true })
  }

  function handleReset() {
    const emptyFilters: LinkQueryDraft = {
      q: "",
      linkStatus: "",
      transactionStatus: "",
      kind: "",
    }

    setDraftFilters(emptyFilters)
    void loadLinks(emptyFilters, 1, { synchronizeDraft: true })
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > tableLinks.totalPages || isBusy) {
      return
    }

    void loadLinks(appliedFilters, nextPage)
  }

  function navigateToDetail(linkId: string) {
    const detailParams = buildAdminTransactionsQueryParams(appliedFilters, tableLinks.page)
    detailParams.delete("tab")

    const href = `/admin/users/${userId}/links/${linkId}?${detailParams.toString()}`
    setPendingRowId(linkId)
    startNavigation(() => {
      router.push(href, { scroll: true })
    })
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleApply}
        className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-muted/30 p-3 lg:flex-row lg:flex-wrap lg:items-end"
      >
        <div className="min-w-0 flex-1 lg:min-w-[16rem]">
          <label
            htmlFor={`admin-vendor-links-search-${userId}`}
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            {sharedT("searchLabel")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`admin-vendor-links-search-${userId}`}
              value={draftFilters.q}
              placeholder={t("transactions.searchPlaceholder")}
              className="h-9 pl-9"
              onChange={(event) => updateDraftFilter("q", event.target.value)}
              disabled={isBusy}
            />
          </div>
        </div>

        <div className="w-full sm:w-[180px]">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("transactions.filters.linkStatus")}
          </label>
          <div className="relative">
            <select
              value={draftFilters.linkStatus}
              disabled={isBusy}
              onChange={(event) => updateDraftFilter("linkStatus", event.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-input/30"
            >
              <option value="">{sharedT("all")}</option>
              {linkStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="w-full sm:w-[200px]">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("transactions.filters.transactionStatus")}
          </label>
          <div className="relative">
            <select
              value={draftFilters.transactionStatus}
              disabled={isBusy}
              onChange={(event) => updateDraftFilter("transactionStatus", event.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-input/30"
            >
              <option value="">{sharedT("all")}</option>
              {transactionStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="w-full sm:w-[160px]">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("transactions.filters.kind")}
          </label>
          <div className="relative">
            <select
              value={draftFilters.kind}
              disabled={isBusy}
              onChange={(event) => updateDraftFilter("kind", event.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-input/30"
            >
              <option value="">{sharedT("all")}</option>
              {kindOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <button
            type="submit"
            disabled={isBusy}
            className={cn(
              buttonVariants({ size: "sm" }),
              "cursor-pointer disabled:pointer-events-none disabled:opacity-70"
            )}
          >
            {isLoading ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" />
                {sharedT("applying")}
              </>
            ) : (
              sharedT("apply")
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isBusy}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "cursor-pointer disabled:pointer-events-none disabled:opacity-60"
            )}
          >
            <RotateCcw className="size-3.5" />
            {sharedT("reset")}
          </button>
        </div>
      </form>

      <div className="relative" aria-busy={isBusy}>
        <motion.div
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: isBusy ? 0.62 : 1,
                  scale: isBusy ? 0.995 : 1,
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
                  {tableLinks.records.length > 0 ? (
                    tableLinks.records.map((record, index) => {
                      const rowPending = isNavigating && pendingRowId === record.id

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
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {record.shortCode ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 font-mono">
                                  {record.shortCode}
                                </span>
                              ) : null}
                              <span>{localeLabels[record.locale] ?? record.locale.toUpperCase()}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium text-foreground">{record.clientName ?? "—"}</p>
                            <p className="text-muted-foreground">{record.clientEmail ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <StatusBadge tone={getStatusTone(record.linkStatus)}>
                                {linkStatusLabels[record.linkStatus] ?? record.linkStatus}
                              </StatusBadge>
                              <StatusBadge tone={getStatusTone(record.transactionStatus)}>
                                {transactionStatusLabels[record.transactionStatus] ?? record.transactionStatus}
                              </StatusBadge>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {formatMoney(record.amount, record.currency, locale)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-foreground">
                            {formatMoney(record.depositAmount, record.currency, locale)}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{record.documentCount}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{record.lastActivityAt}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => navigateToDetail(record.id)}
                              disabled={isBusy}
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
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        {hasActiveFilters(appliedFilters)
                          ? t("transactions.emptyFiltered")
                          : t("transactions.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {tableLinks.totalCount > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {sharedT("showingResults", { start, end, total: tableLinks.totalCount })}
              </p>

              {tableLinks.totalPages > 1 ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => goToPage(tableLinks.page - 1)}
                    disabled={!tableLinks.hasPreviousPage || isBusy}
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
                      <span key={`ellipsis-${index}`} className="select-none px-1 text-sm text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToPage(page)}
                        disabled={page === tableLinks.page || isBusy}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "min-w-[2rem] cursor-pointer disabled:opacity-60",
                          page === tableLinks.page &&
                            "pointer-events-none border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0] hover:text-white",
                          isLoading &&
                            pendingPage === page &&
                            "border-[var(--contrazy-teal)] text-[var(--contrazy-teal)]"
                        )}
                      >
                        {isLoading && pendingPage === page ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          page
                        )}
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => goToPage(tableLinks.page + 1)}
                    disabled={!tableLinks.hasNextPage || isBusy}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "cursor-pointer disabled:pointer-events-none disabled:opacity-40"
                    )}
                  >
                    {sharedT("next")}
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </motion.div>

        <AnimatePresence>{isBusy ? <TablePendingOverlay /> : null}</AnimatePresence>
      </div>
    </div>
  )
}
