"use client"

import Link from "next/link"
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

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

// ── Stat card ────────────────────────────────────────────────────────────────

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

// ── Usage bar ────────────────────────────────────────────────────────────────

function UsageBar({
  label,
  used,
  limit,
  allowed = true,
}: {
  label: string
  used: number
  limit: number | null
  allowed?: boolean
}) {
  if (!allowed) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-medium text-foreground">{label}</span>
          <span className="text-muted-foreground">Not included</span>
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
          <span className="font-semibold text-[var(--contrazy-teal)]">Unlimited — {used} used</span>
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

// ── Plan usage section ────────────────────────────────────────────────────────

function PlanUsageSection({ usage }: { usage: SubscriptionUsageRecord }) {
  const planLabel = usage.planName.toUpperCase()
  const statusLabel = usage.isTrial ? "Trial" : usage.status.charAt(0) + usage.status.slice(1).toLowerCase()
  const periodEndLabel = usage.periodEnd
    ? new Date(usage.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null

  return (
    <div className="space-y-5">
      {/* Plan header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
            <BadgeCheck className="size-4" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-foreground">{planLabel}</p>
            <p className="text-[11px] text-muted-foreground">
              {statusLabel}{periodEndLabel ? ` · Renews ${periodEndLabel}` : ""}
            </p>
          </div>
        </div>
        <DashboardRouteLink
          href="/vendor/billing"
          pendingLabel="Manage"
          className="flex items-center gap-1 text-[11px] font-medium text-[var(--contrazy-teal)] hover:underline"
        >
          Manage <ArrowRight className="size-3" />
        </DashboardRouteLink>
      </div>

      {/* Usage bars */}
      <div className="space-y-3 px-1">
        <UsageBar label="Transactions / month" used={usage.transactions.used} limit={usage.transactions.limit} />
        <UsageBar label="E-Signatures / month" used={usage.eSignatures.used} limit={usage.eSignatures.limit} />
        <UsageBar label="QR Codes / month" used={usage.qrCodes.used} limit={usage.qrCodes.limit} />
        <UsageBar label="Contract templates" used={usage.contractTemplates.used} limit={usage.contractTemplates.limit} />
        <UsageBar label="KYC verifications / month" used={usage.kyc.used} limit={usage.kyc.limit} allowed={usage.kyc.allowed} />
      </div>
    </div>
  )
}

// ── Business status row ───────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export function VendorOverview({ workspace }: VendorOverviewProps) {
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
      {/* Alerts */}
      <AlertStrip items={workspace.alerts} />

      {/* Activity stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Transactions"
          value={stats.totalTransactions}
          detail="Total created"
          icon={CreditCard}
          href="/vendor/transactions"
          teal
        />
        <StatCard
          label="Active deposits"
          value={stats.activeDeposits}
          detail="Authorized holds"
          icon={Wallet}
          href="/vendor/deposits"
        />
        <StatCard
          label="Clients"
          value={stats.totalClients}
          detail="Tracked profiles"
          icon={Users}
          href="/vendor/clients"
        />
        <StatCard
          label="Signed contracts"
          value={stats.signedContracts}
          detail="Completed signatures"
          icon={FileSignature}
          href="/vendor/signatures"
        />
      </div>

      {/* Plan + Usage and Business status */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Plan usage panel */}
        <PagePanel
          title="Plan & usage"
          description="Your current subscription usage for this billing period."
          actionHref="/vendor/billing"
          actionLabel="Billing"
        >
          {subscriptionUsage ? (
            <PlanUsageSection usage={subscriptionUsage} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <BadgeCheck className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No active plan</p>
                <p className="mt-1 text-xs text-muted-foreground">Activate a subscription to start using Conntrazy features.</p>
              </div>
              <DashboardRouteLink
                href="/vendor/billing"
                pendingLabel="View plans"
                className={buttonVariants({ size: "sm", className: "mt-1 bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]" })}
              >
                View plans
              </DashboardRouteLink>
            </div>
          )}
        </PagePanel>

        {/* Business readiness */}
        <PagePanel title="Business readiness" description="Checklist before accepting your first client.">
          <div className="space-y-3">
            {/* Readiness score */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
              {readinessScore === 3 ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : readinessScore === 2 ? (
                <Clock className="size-4 text-amber-500" />
              ) : (
                <AlertCircle className="size-4 text-destructive" />
              )}
              <span className="text-[13px] font-semibold text-foreground">
                {readinessScore === 3 ? "Ready to go live" : `${readinessScore}/3 steps complete`}
              </span>
            </div>

            <StatusRow label="Profile completion" value={`${summary.profileCompletion}%`} plain />
            <StatusRow label="Review status" value={summary.reviewStatus} />
            <StatusRow label="Payout setup" value={summary.stripeConnectionStatus} />
            <StatusRow label="Business" value={`${summary.businessName} · ${summary.businessCountry}`} plain />

            <Link
              href={needsProfileAttention ? "/vendor/profile" : isReviewPending ? "/vendor/profile" : "/vendor/actions"}
              className={buttonVariants({
                className: "h-10 w-full bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
              })}
            >
              {needsProfileAttention
                ? "Complete business profile"
                : hasPayoutIssue
                  ? "Set up payouts"
                  : "Open action queue"}
            </Link>
          </div>
        </PagePanel>
      </div>

      {/* Recent transactions */}
      <PagePanel
        title="Recent transactions"
        description={`Latest customer workflows for ${summary.businessName}.`}
        actionHref="/vendor/transactions"
        actionLabel="All transactions"
      >
        <DashboardTable
          columns={["Client", "Reference", "Type", "Amount", "KYC", "Contract", "Status", "Date"]}
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
          emptyMessage="No customer workflows have been created yet."
        />
      </PagePanel>
    </div>
  )
}
