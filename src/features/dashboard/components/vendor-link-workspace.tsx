"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import type { ChecklistItem, ChecklistTemplate, ContractTemplate } from "@prisma/client"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileText,
  Gauge,
  Plus,
  QrCode,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { VendorCreateLinkDialog } from "@/features/dashboard/components/vendor-create-link-dialog"
import { DashboardTable, StatusBadge } from "@/features/dashboard/components/dashboard-ui"
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

type UsageTone = "default" | "warning" | "danger" | "accent"

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

function getUsagePercent(used: number, limit: number | null) {
  if (limit === null || limit <= 0) return null
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)))
}

function StatusPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 text-black/80 backdrop-blur">
      <Icon className="size-3.5 shrink-0 text-[var(--contrazy-teal)]" />
      <div className="min-w-0 leading-tight">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">
          {label}
        </p>
        <p className="truncate text-xs font-semibold text-black">{value}</p>
      </div>
    </div>
  )
}

function WarningNotice({
  title,
  detail,
}: {
  title: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-900/80 dark:text-amber-300/80">
            {detail}
          </p>
        </div>
      </div>
    </div>
  )
}

function UsageCard({
  label,
  value,
  detail,
  tone = "default",
  icon: Icon,
  percent,
}: {
  label: string
  value: string
  detail: string
  tone?: UsageTone
  icon: React.ElementType
  percent: number | null
}) {
  const t = useTranslations("dashboard.vendor.linkWorkspace")
  const toneClasses: Record<UsageTone, string> = {
    default: "border-border bg-background text-muted-foreground",
    accent:
      "border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]",
    warning:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400",
    danger: "border-destructive/25 bg-destructive/5 text-destructive",
  }

  const meterClasses: Record<UsageTone, string> = {
    default: "bg-muted-foreground/50",
    accent: "bg-[var(--contrazy-teal)]",
    warning: "bg-amber-500",
    danger: "bg-destructive",
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group rounded-2xl border border-border bg-background p-4 shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-950/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>

        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border",
            toneClasses[tone]
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={false}
            animate={{ width: percent === null ? "100%" : `${percent}%` }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              "h-full rounded-full",
              percent === null ? "bg-muted-foreground/30" : meterClasses[tone]
            )}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{percent === null ? t("usage.unlimited") : t("usage.percentUsed", { percent })}</span>
          <span className="opacity-70">{t("usage.currentPeriod")}</span>
        </div>
      </div>
    </motion.div>
  )
}

function MobileTransactionCard({
  record,
  t,
  onRecordChange,
  onUsageChange,
}: {
  record: VendorLinkRecord
  t: ReturnType<typeof useTranslations<"dashboard.vendor.linkWorkspace">>
  onRecordChange: (nextRecord: VendorLinkRecord) => void
  onUsageChange: (nextUsage: VendorActionsUsageRecord | null) => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/vendor/transactions/${record.transactionId}`}
            className="font-semibold text-foreground transition hover:text-[var(--contrazy-teal)]"
          >
            {record.reference}
          </Link>
          <p className="mt-1 truncate text-sm font-medium text-foreground" title={record.title}>
            {record.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={record.clientEmail}>
            {record.clientName} · {record.clientEmail}
          </p>
        </div>

        <StatusBadge tone={getStatusTone(record.status)}>{t(`enums.status.${record.status}` as never)}</StatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("table.columns.amount")}
          </p>
          <div className="mt-1 space-y-0.5">
            {record.kind !== "DEPOSIT" ? (
              <p className="font-semibold text-foreground">{record.serviceAmount}</p>
            ) : null}
            {record.kind !== "PAYMENT" ? (
              <p className="text-xs text-muted-foreground">
                {t("table.holdPrefix")} {record.depositAmount}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("table.columns.lastActivity")}
          </p>
          <p className="mt-1 font-medium text-foreground">{record.lastActivity}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 capitalize">
            {t(`enums.kind.${record.kind}` as never)}
          </span>

          {record.qrReady ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 px-2 py-0.5 text-[var(--contrazy-teal)]">
              <CheckCircle2 className="size-3" />
              {t("table.qrReady")}
            </span>
          ) : (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5">
              {t("table.linkOnly")}
            </span>
          )}
        </div>

        <PaymentLinkManagementActions
          record={record}
          onRecordChange={onRecordChange}
          onUsageChange={onUsageChange}
        />
      </div>
    </div>
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

  function handleCreatedLink(
    nextRecord: VendorLinkRecord,
    nextUsage: VendorActionsUsageRecord | null
  ) {
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
      ? t(`enums.subscriptionStatus.${usageState.status}` as never)
      : t("header.activePlan")

  const periodEndLabel = formatPeriodEnd(usageState?.periodEnd ?? null)

  const txLimit = usageState?.transactions.limit ?? null
  const txUsed = usageState?.transactions.used ?? 0
  const txTotal = usageState?.transactions.limit ?? 0
  const txRemaining = usageState?.transactions.remaining ?? null
  const txPercent = getUsagePercent(txUsed, txLimit)

  const qrLimit = usageState?.qrCodes.limit ?? null
  const qrUsed = usageState?.qrCodes.used ?? 0
  const qrTotal = usageState?.qrCodes.limit ?? 0
  const qrRemaining = usageState?.qrCodes.remaining ?? null
  const qrPercent = getUsagePercent(qrUsed, qrLimit)

  const kycAllowed = usageState?.kyc.allowed
  const kycLimit = usageState?.kyc.limit ?? null
  const kycUsed = usageState?.kyc.used ?? 0
  const kycTotal = usageState?.kyc.limit ?? 0
  const kycRemaining = usageState?.kyc.remaining ?? null
  const kycPercent = getUsagePercent(kycUsed, kycLimit)

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm shadow-slate-950/[0.04]"
      >
        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
          <div className="relative overflow-hidden  p-5 text-black sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(17,201,176,0.32),transparent_22rem),linear-gradient(135deg,rgba(255,255,255,0.10),transparent_38%)]" />

            <div className="relative flex min-h-[260px] flex-col justify-between gap-8">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-black/80 backdrop-blur">
                    <BadgeCheck className="size-3.5 text-[var(--contrazy-teal)]" />
                    {usageState
                      ? `${usageState.planName} ${t("header.planSuffix")}`
                      : t("header.activePlan")}
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--contrazy-teal)]">
                    <Sparkles className="size-3.5" />
                    {statusLabel}
                  </div>
                </div>

                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
                    {t("header.title")}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-black/65">
                    {t("header.description")}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <StatusPill
                  icon={Activity}
                  label={t("header.activePlan")}
                  value={statusLabel}
                />
                <StatusPill
                  icon={CalendarClock}
                  label={t("header.renewsLabel")}
                  value={periodEndLabel ?? "—"}
                />
                <StatusPill
                  icon={Gauge}
                  label={t("table.columns.status")}
                  value={t("header.activitySummary", {
                    active: activeCount,
                    processing: processingCount,
                  })}
                />
              </div>
            </div>
          </div>

          <aside className="flex flex-col justify-between gap-5 border-t border-border bg-muted/20 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div>
              <div className="flex size-10 items-center justify-center rounded-2xl border border-border bg-background text-[var(--contrazy-teal)] shadow-sm">
                <WalletCards className="size-5" />
              </div>

              <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
                {t("header.newTransaction")}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("header.description")}
              </p>
            </div>

            <div className="space-y-2.5">
              <DashboardRouteLink
                href="/vendor/billing"
                pendingLabel={t("header.planUsageLink")}
                className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"
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
                    className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--contrazy-teal)] px-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-[var(--contrazy-teal)]/90 focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0 disabled:bg-muted disabled:text-muted-foreground"
                    onClick={openDialog}
                    disabled={disabled}
                    title={blockedReason ?? undefined}
                  >
                    <Plus className="size-4" />
                    {t("header.newTransaction")}
                  </Button>
                )}
              />
              <VendorCreateLinkDialog
                contracts={contracts}
                checklists={checklists}
                mode="bulk"
                usage={usageState}
                hasStripe={hasStripe}
                canLaunch={canLaunch}
                blockedMessage={blockedMessage}
                renderTrigger={({ openDialog, disabled, blockedReason }) => (
                  <Button
                    type="button"
                    variant="outline"
                    className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm hover:bg-muted focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0 disabled:bg-muted disabled:text-muted-foreground"
                    onClick={openDialog}
                    disabled={disabled}
                    title={blockedReason ?? undefined}
                  >
                    <Users className="size-4" />
                    {t("header.bulkCsv")}
                  </Button>
                )}
              />
            </div>
          </aside>
        </div>

        {headerWarnings.length > 0 ? (
          <div className="border-t border-border bg-background px-4 py-4 sm:px-5">
            <div className="grid gap-3 lg:grid-cols-3">
              {headerWarnings.map((warning) => (
                <WarningNotice
                  key={warning.title}
                  title={warning.title}
                  detail={warning.detail}
                />
              ))}
            </div>
          </div>
        ) : null}
      </motion.section>

      <section className="grid gap-4 lg:grid-cols-3">
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
          percent={txPercent}
        />

        <UsageCard
          label={t("usage.qrCodes")}
          value={qrLimit === null ? t("usage.unlimited") : `${qrRemaining ?? 0}`}
          detail={
            qrLimit === null
              ? t("usage.generatedPeriod", { used: qrUsed })
              : t("usage.generatedOf", { used: qrUsed, total: qrTotal })
          }
          tone={qrRemaining !== null && (qrRemaining ?? 0) <= 0 ? "warning" : "default"}
          icon={QrCode}
          percent={qrPercent}
        />

        <UsageCard
          label={t("usage.kyc")}
          value={
            kycAllowed
              ? kycLimit === null
                ? t("usage.unlimited")
                : `${kycRemaining ?? 0}`
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
          percent={kycPercent}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-background shadow-sm shadow-slate-950/[0.04]">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="size-3.5 text-[var(--contrazy-teal)]" />
              {t("table.title")}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("table.description")}
            </p>
          </div>

          <DashboardRouteLink
            href="/vendor/links"
            pendingLabel={t("table.actionLabel")}
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"
          >
            {t("table.actionLabel")}
            <ArrowRight className="size-4" />
          </DashboardRouteLink>
        </div>

        <div className="block space-y-3 bg-muted/20 p-4 md:hidden">
          {recentLinks.length > 0 ? (
            recentLinks.map((record) => (
              <MobileTransactionCard
                key={record.id}
                record={record}
                t={t}
                onRecordChange={handleRecordChange}
                onUsageChange={handleUsageChange}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
              {t("table.empty")}
            </div>
          )}
        </div>

        <div className="hidden overflow-hidden md:block">
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
                className="inline-block min-w-[130px] font-semibold text-foreground transition hover:text-[var(--contrazy-teal)]"
              >
                {record.reference}
              </Link>,

              <div key={`${record.id}-client`} className="w-[180px] min-w-[180px]">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <UserRound className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate font-medium text-foreground"
                      title={record.clientName}
                    >
                      {record.clientName}
                    </p>
                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={record.clientEmail}
                    >
                      {record.clientEmail}
                    </p>
                  </div>
                </div>
              </div>,

              <div key={`${record.id}-title`} className="w-[240px] min-w-[240px]">
                <p
                  className="truncate text-sm font-semibold text-foreground"
                  title={record.title}
                >
                  {record.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 capitalize">
                    {t(`enums.kind.${record.kind}` as never)}
                  </span>

                  {record.qrReady ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 px-2 py-0.5 text-[var(--contrazy-teal)]">
                      <CheckCircle2 className="size-3" />
                      {t("table.qrReady")}
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5">
                      {t("table.linkOnly")}
                    </span>
                  )}
                </div>
              </div>,

              <div key={`${record.id}-amounts`} className="min-w-[132px] space-y-0.5">
                {record.kind !== "DEPOSIT" ? (
                  <p className="text-sm font-semibold text-foreground">
                    {record.serviceAmount}
                  </p>
                ) : null}

                {record.kind !== "PAYMENT" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("table.holdPrefix")} {record.depositAmount}
                  </p>
                ) : null}
              </div>,

              <span
                key={`${record.id}-last-activity`}
                className="inline-block min-w-[112px] text-sm text-muted-foreground"
              >
                {record.lastActivity}
              </span>,

              <StatusBadge key={`${record.id}-status`} tone={getStatusTone(record.status)}>
                {t(`enums.status.${record.status}` as never)}
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
      </section>
    </div>
  )
}
