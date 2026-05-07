"use client"

import {
  BadgeCheck,
  CreditCard,
  FileSignature,
  Users,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { DashboardRouteLink } from "@/features/dashboard/components/dashboard-route-link"
import {
  AlertStrip,
  DashboardTable,
  PagePanel,
  StatusBadge,
} from "@/features/dashboard/components/dashboard-ui"
import type { SubscriptionUsageRecord, WorkspaceRecord } from "@/features/dashboard/server/dashboard-data"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import { cn } from "@/lib/utils"

type VendorOverviewProps = {
  workspace: WorkspaceRecord
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
  teal,
}: {
  label: string
  value: number
  detail: string
  icon: React.ElementType
  href: string
  teal?: boolean
}) {
  return (
    <Link href={href} className="block group">
      <Card className="border-border bg-card shadow-sm transition-shadow group-hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1.5 text-3xl font-bold tracking-tight text-foreground">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </div>
            <div className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-2xl",
              teal ? "bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="size-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function UsageBar({
  label,
  used,
  limit,
  unlimitedLabel,
  notIncludedLabel,
  allowed = true,
}: {
  label: string
  used: number
  limit: number | null
  unlimitedLabel: string
  notIncludedLabel: string
  allowed?: boolean
}) {
  if (!allowed) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium text-foreground">{label}</span>
          <span className="text-muted-foreground">{notIncludedLabel}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted" />
      </div>
    )
  }

  if (limit === null) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium text-foreground">{label}</span>
          <span className="font-semibold text-[var(--contrazy-teal)]">{unlimitedLabel.replace("{used}", String(used))}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--contrazy-teal)]/20">
          <div className="h-1.5 w-full rounded-full bg-[var(--contrazy-teal)]/40" />
        </div>
      </div>
    )
  }

  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const isWarning = pct >= 80
  const isDanger = pct >= 100

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-foreground">{label}</span>
        <span className={cn(
          "font-semibold",
          isDanger ? "text-destructive" : isWarning ? "text-amber-600" : "text-muted-foreground"
        )}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn(
            "h-1.5 rounded-full transition-all",
            isDanger ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-[var(--contrazy-teal)]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function PlanUsageSection({ usage }: { usage: SubscriptionUsageRecord }) {
  const t = useTranslations("dashboard.vendor.overview")
  const planLabel = usage.planName.toUpperCase()
  const statusLabel = usage.isTrial ? t("usage.trial") : usage.status.charAt(0) + usage.status.slice(1).toLowerCase()
  const periodEndLabel = usage.periodEnd
    ? new Date(usage.periodEnd).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
            <BadgeCheck className="size-4" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground">{planLabel}</p>
            <p className="text-[11px] text-muted-foreground">
              {statusLabel}{periodEndLabel ? ` · ${t("planUsage.renews", { date: periodEndLabel })}` : ""}
            </p>
          </div>
        </div>
        <DashboardRouteLink
          href="/vendor/billing"
          pendingLabel={t("planUsage.manage")}
          className="flex items-center gap-1 text-[11px] font-medium text-[var(--contrazy-teal)] hover:underline"
        >
          {t("planUsage.manage")} <ArrowRight className="size-3" />
        </DashboardRouteLink>
      </div>

      <div className="space-y-3 px-1">
        <UsageBar label={t("usage.transactions")} used={usage.transactions.used} limit={usage.transactions.limit} unlimitedLabel={t("usage.unlimited")} notIncludedLabel={t("usage.notIncluded")} />
        <UsageBar label={t("usage.eSignatures")} used={usage.eSignatures.used} limit={usage.eSignatures.limit} unlimitedLabel={t("usage.unlimited")} notIncludedLabel={t("usage.notIncluded")} />
        <UsageBar label={t("usage.qrCodes")} used={usage.qrCodes.used} limit={usage.qrCodes.limit} unlimitedLabel={t("usage.unlimited")} notIncludedLabel={t("usage.notIncluded")} />
        <UsageBar label={t("usage.contractTemplates")} used={usage.contractTemplates.used} limit={usage.contractTemplates.limit} unlimitedLabel={t("usage.unlimited")} notIncludedLabel={t("usage.notIncluded")} />
        <UsageBar label={t("usage.kyc")} used={usage.kyc.used} limit={usage.kyc.limit} unlimitedLabel={t("usage.unlimited")} notIncludedLabel={t("usage.notIncluded")} allowed={usage.kyc.allowed} />
      </div>
    </div>
  )
}

function StatusRow({ label, value, plain = false }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {plain ? (
        <span className="text-right text-sm font-medium text-foreground">{value}</span>
      ) : (
        <StatusBadge tone={getStatusTone(value)}>{value}</StatusBadge>
      )}
    </div>
  )
}

export function VendorOverview({ workspace }: VendorOverviewProps) {
  const t = useTranslations("dashboard.vendor.overview")
  const { summary, stats, subscriptionUsage } = workspace
  const needsProfileAttention = summary.profileCompletion < 100
  const isReviewPending = summary.reviewStatus === "PENDING"
  const hasPayoutIssue =
    summary.stripeConnectionStatus === "NOT_CONNECTED" ||
    summary.stripeConnectionStatus === "PENDING"

  const readinessScore =
    (summary.profileCompletion === 100 ? 1 : 0) +
    (summary.reviewStatus === "APPROVED" ? 1 : 0) +
    (!hasPayoutIssue ? 1 : 0)

  return (
    <div className="space-y-6">
      <AlertStrip items={workspace.alerts} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("transactions.label")}
          value={stats.totalTransactions}
          detail={t("transactions.detail")}
          icon={CreditCard}
          href="/vendor/transactions"
          teal
        />
        <StatCard
          label={t("activeDeposits.label")}
          value={stats.activeDeposits}
          detail={t("activeDeposits.detail")}
          icon={Wallet}
          href="/vendor/deposits"
        />
        <StatCard
          label={t("clients.label")}
          value={stats.totalClients}
          detail={t("clients.detail")}
          icon={Users}
          href="/vendor/clients"
        />
        <StatCard
          label={t("signedContracts.label")}
          value={stats.signedContracts}
          detail={t("signedContracts.detail")}
          icon={FileSignature}
          href="/vendor/signatures"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <PagePanel
          title={t("planUsage.title")}
          description={t("planUsage.description")}
          actionHref="/vendor/billing"
          actionLabel={t("planUsage.billing")}
        >
          {subscriptionUsage ? (
            <PlanUsageSection usage={subscriptionUsage} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <BadgeCheck className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("noActivePlan.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("noActivePlan.description")}</p>
              </div>
              <DashboardRouteLink
                href="/vendor/billing"
                pendingLabel={t("noActivePlan.viewPlans")}
                className={buttonVariants({ size: "sm", className: "mt-1 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]" })}
              >
                {t("noActivePlan.viewPlans")}
              </DashboardRouteLink>
            </div>
          )}
        </PagePanel>

        <PagePanel title={t("businessReadiness.title")} description={t("businessReadiness.description")}>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
              {readinessScore === 3 ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : readinessScore === 2 ? (
                <Clock className="size-4 text-amber-500" />
              ) : (
                <AlertCircle className="size-4 text-destructive" />
              )}
              <span className="text-[13px] font-semibold text-foreground">
                {readinessScore === 3 ? t("readyToGoLive") : t("stepsComplete", { n: readinessScore })}
              </span>
            </div>

            <StatusRow label={t("profileCompletion")} value={`${summary.profileCompletion}%`} plain />
            <StatusRow label={t("reviewStatus")} value={summary.reviewStatus} />
            <StatusRow label={t("payoutSetup")} value={summary.stripeConnectionStatus} />
            <StatusRow label={t("business")} value={`${summary.businessName} · ${summary.businessCountry}`} plain />

            <Link
              href={needsProfileAttention ? "/vendor/profile" : isReviewPending ? "/vendor/profile" : "/vendor/actions"}
              className={buttonVariants({
                className: "h-10 w-full bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
              })}
            >
              {needsProfileAttention
                ? t("completeProfile")
                : hasPayoutIssue
                  ? t("setUpPayouts")
                  : t("openActionQueue")}
            </Link>
          </div>
        </PagePanel>
      </div>

      <PagePanel
        title={t("recentTransactions.title")}
        description={t("recentTransactions.description", { businessName: summary.businessName })}
        actionHref="/vendor/transactions"
        actionLabel={t("recentTransactions.allTransactions")}
      >
        <DashboardTable
          columns={[
            t("table.client"),
            t("table.reference"),
            t("table.type"),
            t("table.amount"),
            t("table.kyc"),
            t("table.contract"),
            t("table.status"),
            t("table.date"),
          ]}
          rows={workspace.transactions.slice(0, 5).map((transaction) => [
            <div key={`${transaction.reference}-client`}>
              <p className="font-medium text-foreground">{transaction.clientName}</p>
              <p className="text-xs text-muted-foreground">{transaction.clientEmail}</p>
            </div>,
            <Link
              key={`${transaction.reference}-link`}
              href={`/vendor/transactions/${transaction.id}`}
              className="font-medium text-foreground hover:text-[var(--contrazy-teal)]"
            >
              {transaction.reference}
            </Link>,
            transaction.kind,
            transaction.amount,
            <StatusBadge key={`${transaction.reference}-kyc`} tone={getStatusTone(transaction.kyc)}>
              {transaction.kyc}
            </StatusBadge>,
            <StatusBadge key={`${transaction.reference}-contract`} tone={getStatusTone(transaction.contract)}>
              {transaction.contract}
            </StatusBadge>,
            <StatusBadge key={`${transaction.reference}-status`} tone={getStatusTone(transaction.status)}>
              {transaction.status}
            </StatusBadge>,
            transaction.date,
          ])}
          emptyMessage={t("noWorkflows")}
        />
      </PagePanel>
    </div>
  )
}
