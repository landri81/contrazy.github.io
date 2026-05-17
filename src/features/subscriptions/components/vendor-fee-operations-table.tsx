"use client"

import { useState } from "react"
import { Download, Loader2, Receipt, TrendingDown } from "lucide-react"
import { useTranslations } from "next-intl"

import type { BillingFeeOperation, BillingFeeSummary } from "@/features/subscriptions/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(amount: number, currency: string, locale = "en") {
  const intlLocale = locale === "fr" ? "fr-FR" : "en-GB"
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  } catch {
    return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`
  }
}

function formatDate(iso: string | null | undefined, locale = "en") {
  if (!iso) return "—"
  const intlLocale = locale === "fr" ? "fr-FR" : "en-GB"
  return new Date(iso).toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function buildPageWindow(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const result: (number | "...")[] = [1]
  if (current > 3) result.push("...")
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let p = start; p <= end; p++) result.push(p)
  if (current < total - 2) result.push("...")
  result.push(total)
  return result
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const toneClass =
    status === "SUCCEEDED" || status === "CAPTURED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "RELEASED"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : status === "AUTHORIZED"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-600"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
        toneClass
      )}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function VendorFeeOperationsTable({
  feeOperations,
  feeSummary,
  locale = "en",
}: {
  feeOperations: BillingFeeOperation[]
  feeSummary: BillingFeeSummary
  locale?: string
}) {
  const t = useTranslations("subscriptions.billing.feeOperations")
  const [page, setPage] = useState(1)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const defaultCurrency =
    feeOperations.length > 0 ? (feeOperations[0]?.currency ?? "EUR") : "EUR"

  const totalPages = Math.max(1, Math.ceil(feeOperations.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const from = (safePage - 1) * PAGE_SIZE + 1
  const to = Math.min(safePage * PAGE_SIZE, feeOperations.length)
  const visibleOps = feeOperations.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pageWindow = buildPageWindow(safePage, totalPages)

  async function handleDownload(op: BillingFeeOperation) {
    if (loadingId) return
    setLoadingId(op.paymentId)
    try {
      const url = op.invoiceUrl.includes("?")
        ? `${op.invoiceUrl}&locale=${locale}`
        : `${op.invoiceUrl}?locale=${locale}`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Download failed")
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `contrazy-invoice-${op.invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error("Invoice download failed:", err)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <TrendingDown className="size-4 text-muted-foreground" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </h2>
      </div>

      <p className="text-[12px] text-muted-foreground">{t("description")}</p>

      {/* Stripe portal note */}
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        {t("stripePortalNote")}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label={t("summary.contrazyFees")}
          value={formatCents(feeSummary.totalContrazyFees, defaultCurrency, locale)}
        />
        <SummaryCard
          label={t("summary.stripeFees")}
          value={formatCents(feeSummary.totalStripeFees, defaultCurrency, locale)}
        />
        <SummaryCard
          label={t("summary.operations")}
          value={String(feeSummary.totalOperations)}
        />
        <SummaryCard
          label={t("summary.latestOperation")}
          value={
            feeSummary.latestOperationDate
              ? formatDate(feeSummary.latestOperationDate, locale)
              : t("neverBilled")
          }
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[18px] border border-border bg-background shadow-sm">
        {feeOperations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Receipt className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 text-left">{t("columns.reference")}</th>
                    <th className="hidden px-4 py-3 text-left sm:table-cell">
                      {t("columns.client")}
                    </th>
                    <th className="hidden px-4 py-3 text-left md:table-cell">
                      {t("columns.operation")}
                    </th>
                    <th className="hidden px-4 py-3 text-left lg:table-cell">
                      {t("columns.date")}
                    </th>
                    <th className="px-4 py-3 text-right">{t("columns.gross")}</th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">
                      {t("columns.stripeFee")}
                    </th>
                    <th className="hidden px-4 py-3 text-right sm:table-cell">
                      {t("columns.contrazyFee")}
                    </th>
                    <th className="px-4 py-3 text-right">{t("columns.totalFees")}</th>
                    <th className="hidden px-4 py-3 text-right md:table-cell">
                      {t("columns.vendorNet")}
                    </th>
                    <th className="px-4 py-3 text-right">{t("columns.invoice")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleOps.map((op) => {
                    const isLoading = loadingId === op.paymentId

                    return (
                      <tr key={op.paymentId} className="group transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-mono text-[11px] font-semibold text-foreground">
                              {op.reference}
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                              {op.title}
                            </p>
                            <div className="mt-1 sm:hidden">
                              <StatusBadge status={op.status} />
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                          {op.clientName ?? "—"}
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="text-muted-foreground">
                            {t(`kinds.${op.kind}` as Parameters<typeof t>[0], {
                              default: op.kind,
                            })}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                          {formatDate(op.processedAt, locale)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatCents(op.grossAmount, op.currency, locale)}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                          {formatCents(op.stripeFee, op.currency, locale)}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">
                          {formatCents(op.contrazyFee, op.currency, locale)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-destructive/80">
                          {formatCents(op.totalFees, op.currency, locale)}
                        </td>
                        <td className="hidden px-4 py-3 text-right font-semibold text-(--contrazy-teal) md:table-cell">
                          {formatCents(op.vendorNet, op.currency, locale)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownload(op)}
                            disabled={!!loadingId}
                            title={t("downloadInvoice")}
                            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isLoading ? (
                              <Loader2 className="size-3 shrink-0 animate-spin" />
                            ) : (
                              <Download className="size-3 shrink-0" />
                            )}
                            <span className="hidden sm:inline">{t("downloadInvoice")}</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-[12px] text-muted-foreground">
                  {t("showingRange", { from, to, total: feeOperations.length })}
                </p>

                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    {t("prevPage")}
                  </Button>

                  {pageWindow.map((entry, index) =>
                    entry === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-1 text-sm text-muted-foreground"
                      >
                        …
                      </span>
                    ) : (
                      <Button
                        key={entry}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(entry as number)}
                        disabled={entry === safePage}
                        className={cn(
                          "min-w-9",
                          entry === safePage &&
                            "border-(--contrazy-teal) bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0] hover:text-white disabled:opacity-100"
                        )}
                      >
                        {entry}
                      </Button>
                    )
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    {t("nextPage")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
