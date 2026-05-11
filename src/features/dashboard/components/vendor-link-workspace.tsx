"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import type { ChecklistItem, ChecklistTemplate, ContractTemplate } from "@prisma/client"
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Plus,
  QrCode,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { VendorCreateLinkDialog } from "@/features/dashboard/components/vendor-create-link-dialog"
import { DashboardTable, PagePanel, StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import { PaymentLinkManagementActions } from "@/features/dashboard/components/payment-link-management-actions"
import { DashboardRouteLink } from "@/features/dashboard/components/dashboard-route-link"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import { Link } from "@/i18n/navigation"
import type {
  VendorActionsUsageRecord,
  VendorLinkRecord,
} from "@/features/dashboard/server/dashboard-data"
import { cn } from "@/lib/utils"

type VendorLinkWorkspaceProps = {
  contracts: ContractTemplate[]
  checklists: Array<ChecklistTemplate & { items: ChecklistItem[] }>
  usage: VendorActionsUsageRecord | null
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  initialLinks: VendorLinkRecord[]
}

function isLiveStatus(status: string) {
  return status === "ACTIVE" || status === "PROCESSING"
}

function formatPeriodEnd(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function UsageCard({
  label,
  value,
  detail,
  tone = "default",
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  tone?: "default" | "warning" | "danger" | "accent"
  icon: React.ElementType
}) {
  const toneClasses: Record<NonNullable<typeof tone>, string> = {
    default: "border-border/80 bg-white/90 text-foreground",
    warning: "border-amber-200/90 bg-amber-50/95 text-amber-950",
    danger: "border-red-200/90 bg-red-50/95 text-red-950",
    accent: "border-[var(--contrazy-teal)]/18 bg-[var(--contrazy-teal)]/6 text-foreground",
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-2xl border px-4 py-3.5 shadow-sm", toneClasses[tone])}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-[1.9rem] leading-none font-semibold tracking-tight">{value}</p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-2xl bg-background/95 shadow-sm ring-1 ring-border/60">
          <Icon className="size-[15px]" />
        </div>
      </div>
    </motion.div>
  )
}

export function VendorLinkWorkspace({
  contracts,
  checklists,
  usage,
  hasStripe,
  canLaunch,
  blockedMessage,
  initialLinks,
}: VendorLinkWorkspaceProps) {
  const t = useTranslations("dashboard.vendor.linkWorkspace")
  const [recentLinks, setRecentLinks] = useState(initialLinks)
  const [usageState, setUsageState] = useState(usage)

  const activeCount = recentLinks.filter((item) => item.status === "ACTIVE").length
  const processingCount = recentLinks.filter((item) => item.status === "PROCESSING").length
  const transactionLimitReached =
    usageState?.transactions.remaining !== null &&
    (usageState?.transactions.remaining ?? 0) <= 0

  const headerWarnings = useMemo(() => {
    const warnings: Array<{ title: string; detail: string }> = []

    if (!canLaunch) {
      warnings.push({
        title: t("warnings.reviewRequired"),
        detail: blockedMessage,
      })
    }

    if (!hasStripe) {
      warnings.push({
        title: t("warnings.stripeRequired"),
        detail: t("warnings.stripeRequiredDetail"),
      })
    }

    if (transactionLimitReached) {
      warnings.push({
        title: t("warnings.quotaReached"),
        detail: t("warnings.quotaReachedDetail"),
      })
    }

    return warnings
  }, [blockedMessage, canLaunch, hasStripe, transactionLimitReached, t])

  function handleCreatedLink(nextRecord: VendorLinkRecord, nextUsage: VendorActionsUsageRecord | null) {
    setRecentLinks((current) => {
      const next = [nextRecord, ...current.filter((item) => item.id !== nextRecord.id)]
      return next.filter((item) => isLiveStatus(item.status)).slice(0, 6)
    })
    setUsageState(nextUsage)
  }

  function handleRecordChange(nextRecord: VendorLinkRecord) {
    setRecentLinks((current) => {
      const next = current.map((item) => (item.id === nextRecord.id ? nextRecord : item))
      return next.filter((item) => isLiveStatus(item.status)).slice(0, 6)
    })
  }

  function handleUsageChange(nextUsage: VendorActionsUsageRecord | null) {
    setUsageState(nextUsage)
  }

  const statusLabel = usageState?.isTrial
    ? t("header.trialStatus")
    : usageState?.status
      ? usageState.status.charAt(0) + usageState.status.slice(1).toLowerCase()
      : t("header.activePlan")

  const periodEndLabel = formatPeriodEnd(usageState?.periodEnd ?? null)

  const txLimit = usageState?.transactions.limit ?? null
  const txUsed = usageState?.transactions.used ?? 0
  const txTotal = usageState?.transactions.limit ?? 0
  const txRemaining = usageState?.transactions.remaining ?? null

  const qrLimit = usageState?.qrCodes.limit ?? null
  const qrUsed = usageState?.qrCodes.used ?? 0
  const qrTotal = usageState?.qrCodes.limit ?? 0
  const qrRemaining = usageState?.qrCodes.remaining ?? null

  const kycAllowed = usageState?.kyc.allowed
  const kycLimit = usageState?.kyc.limit ?? null
  const kycUsed = usageState?.kyc.used ?? 0
  const kycTotal = usageState?.kyc.limit ?? 0
  const kycRemaining = usageState?.kyc.remaining ?? null

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.98))] p-5 text-foreground shadow-[0_20px_45px_-28px_rgba(15,23,42,0.24)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.06),transparent_26%)]" />
        <div className="relative space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl space-y-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--contrazy-teal)]/18 bg-[var(--contrazy-teal)]/7 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-slate-700 uppercase">
                <BadgeCheck className="size-3.5 text-[var(--contrazy-teal)]" />
                {usageState ? `${usageState.planName} ${t("header.planSuffix")}` : t("header.activePlan")}
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{t("header.title")}</h2>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{t("header.description")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/80 bg-background/80 px-3 py-1">
                  {statusLabel}
                </span>
                <span className="rounded-full border border-border/80 bg-background/80 px-3 py-1">
                  {t("header.renewsLabel")} {periodEndLabel ?? "—"}
                </span>
                <span className="rounded-full border border-border/80 bg-background/80 px-3 py-1">
                  {t("header.activitySummary", { active: activeCount, processing: processingCount })}
                </span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:flex-row xl:w-auto xl:justify-end">
              <DashboardRouteLink
                href="/vendor/billing"
                pendingLabel={t("header.planUsageLink")}
                className="inline-flex items-center justify-center rounded-2xl border border-border/80 bg-background/90 px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-background"
              >
                {t("header.planUsageLink")}
                <ArrowUpRight className="size-4" />
              </DashboardRouteLink>
              <VendorCreateLinkDialog
                contracts={contracts}
                checklists={checklists}
                usage={usageState}
                hasStripe={hasStripe}
                canLaunch={canLaunch}
                blockedMessage={blockedMessage}
                onLinkCreated={handleCreatedLink}
                renderTrigger={({ openDialog, disabled, blockedReason }) => (
                  <Button
                    type="button"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--contrazy-teal)] px-4 text-sm font-semibold text-slate-950 hover:bg-[var(--contrazy-teal)]/90 disabled:bg-muted disabled:text-muted-foreground"
                    onClick={openDialog}
                    disabled={disabled}
                    title={blockedReason ?? undefined}
                  >
                    <Plus className="size-4" />
                    {t("header.newTransaction")}
                  </Button>
                )}
              />
            </div>
          </div>

          {headerWarnings.length > 0 ? (
            <div className="grid gap-2 lg:grid-cols-3">
              {headerWarnings.map((warning) => (
                <div
                  key={warning.title}
                  className="rounded-2xl border border-amber-200/80 bg-amber-50/85 px-3.5 py-3 text-sm text-amber-950"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold">{warning.title}</p>
                      <p className="mt-1 text-xs leading-5 text-amber-900/80">{warning.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            <UsageCard
              label={t("usage.transactions")}
              value={txLimit === null ? t("usage.unlimited") : `${txRemaining ?? 0}`}
              detail={
                txLimit === null
                  ? t("usage.launchedPeriod", { used: txUsed })
                  : t("usage.usedOf", { used: txUsed, total: txTotal })
              }
              tone={transactionLimitReached ? "danger" : "accent"}
              icon={CreditCard}
            />
            <UsageCard
              label={t("usage.qrCodes")}
              value={qrLimit === null ? t("usage.unlimited") : `${qrRemaining ?? 0}`}
              detail={
                qrLimit === null
                  ? t("usage.generatedPeriod", { used: qrUsed })
                  : t("usage.generatedOf", { used: qrUsed, total: qrTotal })
              }
              tone={
                qrRemaining !== null && (qrRemaining ?? 0) <= 0 ? "warning" : "default"
              }
              icon={QrCode}
            />
            <UsageCard
              label={t("usage.kyc")}
              value={
                kycAllowed
                  ? kycLimit === null ? t("usage.unlimited") : `${kycRemaining ?? 0}`
                  : t("usage.unavailable")
              }
              detail={
                !kycAllowed
                  ? t("usage.kycUnavailableHint")
                  : kycLimit === null
                    ? t("usage.verificationRequests", { used: kycUsed })
                    : t("usage.usedOf", { used: kycUsed, total: kycTotal })
              }
              tone={kycAllowed ? "default" : "warning"}
              icon={ShieldCheck}
            />
          </div>
        </div>
      </motion.section>

      <PagePanel
        title={t("table.title")}
        description={t("table.description")}
        actionHref="/vendor/links"
        actionLabel={t("table.actionLabel")}
      >
        <div className="overflow-hidden rounded-xl border">
          <DashboardTable
            columns={[
              t("table.columns.reference"),
              t("table.columns.client"),
              t("table.columns.title"),
              t("table.columns.amount"),
              t("table.columns.lastActivity"),
              t("table.columns.status"),
              t("table.columns.actions"),
            ]}
            rows={recentLinks.map((record) => [
              <Link
                key={`${record.id}-reference`}
                href={`/vendor/transactions/${record.transactionId}`}
                className="inline-block min-w-[130px] font-medium text-foreground hover:text-(--contrazy-teal)"
              >
                {record.reference}
              </Link>,

              <div key={`${record.id}-client`} className="w-[180px] min-w-[180px]">
                <p className="truncate font-medium text-foreground" title={record.clientName}>
                  {record.clientName}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={record.clientEmail}>
                  {record.clientEmail}
                </p>
              </div>,

              <div key={`${record.id}-title`} className="w-[240px] min-w-[240px]">
                <p
                  className="truncate text-sm font-medium text-foreground"
                  title={record.title}
                >
                  {record.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{record.kind.replaceAll("_", " ").toLowerCase()}</span>
                  {record.qrReady ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      <CheckCircle2 className="size-3" />
                      {t("table.qrReady")}
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5">
                      {t("table.linkOnly")}
                    </span>
                  )}
                </div>
              </div>,

              <div key={`${record.id}-amounts`} className="min-w-[132px] space-y-0.5">
                {record.kind !== "DEPOSIT" && (
                  <p className="text-sm font-medium text-foreground">{record.serviceAmount}</p>
                )}
                {record.kind !== "PAYMENT" && (
                  <p className="text-xs text-muted-foreground">{t("table.holdPrefix")} {record.depositAmount}</p>
                )}
              </div>,

              <span
                key={`${record.id}-last-activity`}
                className="inline-block min-w-[112px] text-sm text-muted-foreground"
              >
                {record.lastActivity}
              </span>,

              <StatusBadge key={`${record.id}-status`} tone={getStatusTone(record.status)}>
                {record.status}
              </StatusBadge>,

              <PaymentLinkManagementActions
                key={record.id}
                record={record}
                onRecordChange={handleRecordChange}
                onUsageChange={handleUsageChange}
              />,
            ])}
            emptyMessage={t("table.empty")}
          />
        </div>
      </PagePanel>
    </div>
  )
}
