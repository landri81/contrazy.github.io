"use client"

import { motion } from "framer-motion"
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileSignature,
  Link2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Unlock,
  Users,
  Wallet,
} from "lucide-react"
import { useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Link } from "@/i18n/navigation"
import { VendorCreateLinkDialog } from "@/features/dashboard/components/vendor-create-link-dialog"
import { DashboardRouteLink } from "@/features/dashboard/components/dashboard-route-link"
import { StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import {
  type DashboardStatusLabelKey,
  getDashboardStatusLabelKey,
  humanizeStatusLabel,
} from "@/features/dashboard/lib/status-labels"
import type {
  AlertRecord,
  SubscriptionUsageRecord,
  VendorActionsUsageRecord,
  VendorCreateLinkDialogData,
  VendorOverviewActivityRecord,
  WorkspaceRecord,
} from "@/features/dashboard/server/dashboard-data"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import { cn } from "@/lib/utils"

type VendorOverviewProps = {
  workspace: WorkspaceRecord
  createLinkDialog: VendorCreateLinkDialogData & {
    usage: VendorActionsUsageRecord | null
    hasStripe: boolean
    canLaunch: boolean
    blockedMessage: string
  }
}

type DashboardTone = "success" | "warning" | "danger" | "neutral" | "info"

const surfaceClass =
  "overflow-hidden rounded-[26px] bg-white/82 backdrop-blur-xl ring-1 ring-slate-950/[0.05] shadow-[0_18px_44px_-28px_rgba(15,23,42,0.18)]"

const alertToneLabelKeys = {
  success: "alertTones.success",
  warning: "alertTones.warning",
  danger: "alertTones.danger",
  neutral: "alertTones.neutral",
  info: "alertTones.info",
} as const satisfies Record<AlertRecord["tone"], string>

const overviewStatusTranslationKeys = {
  active: "statusLabels.active",
  trialing: "statusLabels.trialing",
  pending: "statusLabels.pending",
  approved: "statusLabels.approved",
  rejected: "statusLabels.rejected",
  suspended: "statusLabels.suspended",
  connected: "statusLabels.connected",
  notConnected: "statusLabels.notConnected",
  missing: "statusLabels.missing",
  optional: "statusLabels.optional",
  required: "statusLabels.required",
  incomplete: "statusLabels.incomplete",
  expired: "statusLabels.expired",
  canceled: "statusLabels.canceled",
  attached: "statusLabels.attached",
  signed: "statusLabels.signed",
} as const satisfies Record<DashboardStatusLabelKey, string>

const planNameTranslationKeys = {
  starter: "starter.name",
  pro: "pro.name",
  business: "business.name",
  enterprise: "enterprise.name",
} as const

function useOverviewStatusLabel() {
  const t = useTranslations("dashboard.vendor.overview")

  return (value: string) => {
    const key = getDashboardStatusLabelKey(value)
    return key ? t(overviewStatusTranslationKeys[key]) : humanizeStatusLabel(value)
  }
}

function useOverviewToneLabel() {
  const t = useTranslations("dashboard.vendor.overview")
  return (tone: AlertRecord["tone"]) => t(alertToneLabelKeys[tone])
}

function useRecentTransactionLabel() {
  const t = useTranslations("dashboard.vendor.transactions")

  return {
    kind: (value: string) => t(`enums.kind.${value}` as never),
    kyc: (value: string) => t(`enums.kyc.${value}` as never),
    contract: (value: string) => t(`enums.contract.${value}` as never),
    status: (value: string) => t(`enums.status.${value}` as never),
  }
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string
  tone?: DashboardTone
}) {
  const toneClasses: Record<DashboardTone, string> = {
    success: "bg-emerald-500/[0.08] text-emerald-700 ring-emerald-500/[0.12]",
    warning: "bg-amber-500/[0.09] text-amber-700 ring-amber-500/[0.14]",
    danger: "bg-red-500/[0.08] text-red-700 ring-red-500/[0.12]",
    neutral: "bg-slate-900/[0.04] text-slate-700 ring-slate-900/[0.08]",
    info: "bg-sky-500/[0.08] text-sky-700 ring-sky-500/[0.12]",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
        toneClasses[tone]
      )}
    >
      {label}
    </span>
  )
}

function toneFromAlert(tone: AlertRecord["tone"]): DashboardTone {
  switch (tone) {
    case "success":
    case "warning":
    case "danger":
    case "neutral":
    case "info":
      return tone
    default:
      return "neutral"
  }
}

function SectionShell({
  title,
  actionHref,
  actionLabel,
  children,
  className,
  contentClassName,
}: {
  title: string
  actionHref?: string
  actionLabel?: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section className={cn(surfaceClass, className)}>
      <div className="flex items-center justify-between gap-4 border-b border-slate-950/[0.05] px-5 py-4 sm:px-6">
        <h2 className="font-sans text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
          {title}
        </h2>
        {actionHref && actionLabel ? (
          <DashboardRouteLink
            href={actionHref}
            pendingLabel={actionLabel}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {actionLabel}
            <ArrowRight className="size-3.5" />
          </DashboardRouteLink>
        ) : null}
      </div>
      <div className={cn("px-5 py-4 sm:px-6 sm:py-5", contentClassName)}>{children}</div>
    </section>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: React.ElementType
  title: string
  description: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900/[0.04] text-muted-foreground">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <DashboardRouteLink
          href={actionHref}
          pendingLabel={actionLabel}
          className={buttonVariants({
            size: "sm",
            className: "bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
          })}
        >
          {actionLabel}
        </DashboardRouteLink>
      ) : null}
    </div>
  )
}

function AttentionRail({ items }: { items: WorkspaceRecord["alerts"] }) {
  const formatToneLabel = useOverviewToneLabel()

  if (items.length === 0) {
    return null
  }

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {items.map((item, index) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className={cn(surfaceClass, "overflow-hidden")}
        >
          <div
            className={cn(
              "h-1.5 w-full",
              item.tone === "success" && "bg-emerald-500/80",
              item.tone === "warning" && "bg-amber-500/80",
              item.tone === "danger" && "bg-red-500/80",
              item.tone === "info" && "bg-sky-500/80",
              item.tone === "neutral" && "bg-slate-300"
            )}
          />
          <div className="space-y-3 px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      item.tone === "success" && "bg-emerald-500",
                      item.tone === "warning" && "bg-amber-500",
                      item.tone === "danger" && "bg-red-500",
                      item.tone === "info" && "bg-sky-500",
                      item.tone === "neutral" && "bg-slate-400"
                    )}
                  />
                  <p className="font-medium text-foreground">{item.title}</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
              <StatusPill label={formatToneLabel(item.tone)} tone={toneFromAlert(item.tone)} />
            </div>
            {item.href && item.hrefLabel ? (
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--contrazy-teal)] transition-colors hover:text-[#0eb8a0]"
              >
                {item.hrefLabel}
                <ArrowRight className="size-3.5" />
              </Link>
            ) : null}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function HeroSnapshotItem({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: DashboardTone
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/74 px-4 py-3 ring-1 ring-slate-950/[0.05]">
      <span className="text-sm text-muted-foreground">{label}</span>
      <StatusPill label={value} tone={tone} />
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  href,
}: {
  label: string
  value: string
  detail: string
  icon: React.ElementType
  href: string
}) {
  return (
    <Link href={href} className="block">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={cn(
          surfaceClass,
          "group h-full px-4 py-4 transition-[box-shadow,transform] sm:px-5"
        )}
      >
        <div className="flex h-full items-start justify-between gap-3">
          <div className="space-y-2.5">
            <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              {label}
            </p>
            <div>
              <p className="text-[1.9rem] font-semibold tracking-tight text-foreground">
                {value}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{detail}</p>
            </div>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900/[0.03] text-foreground ring-1 ring-slate-950/[0.05] transition-transform duration-200 group-hover:scale-105">
            <Icon className="size-4" />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

function PipelineCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string
  value: string
  detail: string
  icon: React.ElementType
  tone?: DashboardTone
}) {
  const toneClasses: Record<DashboardTone, string> = {
    success: "bg-emerald-500/[0.05]",
    warning: "bg-amber-500/[0.06]",
    danger: "bg-red-500/[0.05]",
    neutral: "bg-slate-900/[0.025]",
    info: "bg-sky-500/[0.05]",
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="h-full rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,249,251,0.92))] p-4 ring-1 ring-slate-950/[0.05]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-xl text-foreground ring-1 ring-slate-950/[0.06]",
            toneClasses[tone]
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <p className="text-[1.9rem] font-semibold tracking-tight text-foreground">{value}</p>
        <p className="text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
    </motion.div>
  )
}

function UsageMeter({
  label,
  used,
  limit,
  statusLabel,
  caption,
  allowed = true,
  className,
}: {
  label: string
  used: number
  limit: number | null
  statusLabel: string
  caption: string
  allowed?: boolean
  className?: string
}) {
  const pct = !allowed ? 0 : limit === null ? 100 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const tone: DashboardTone = !allowed
    ? "neutral"
    : limit !== null && pct >= 100
      ? "danger"
      : limit !== null && pct >= 80
        ? "warning"
        : "success"

  const fillClass =
    tone === "danger"
      ? "from-red-500 to-red-400"
      : tone === "warning"
        ? "from-amber-500 to-amber-400"
        : "from-[var(--contrazy-teal)] to-[#56d8c5]"

  return (
    <div
      className={cn(
        "space-y-2 rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,250,252,0.9))] px-4 py-3 ring-1 ring-slate-950/[0.05]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-medium text-muted-foreground">{statusLabel}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-900/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn("h-full rounded-full bg-gradient-to-r shadow-sm", fillClass)}
        />
      </div>
      {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  )
}

function PlanUsageSection({
  usage,
  locale,
}: {
  usage: SubscriptionUsageRecord
  locale: string
}) {
  const t = useTranslations("dashboard.vendor.overview")
  const tPlans = useTranslations("subscriptions.plans")
  const formatStatusLabel = useOverviewStatusLabel()
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale]
  )
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])

  const planKey = planNameTranslationKeys[usage.planSlug as keyof typeof planNameTranslationKeys]
  const planLabel = (planKey ? tPlans(planKey) : usage.planName).toUpperCase()
  const statusLabel = usage.isTrial ? t("usage.trial") : formatStatusLabel(usage.status)
  const periodEndLabel = usage.periodEnd ? dateFormatter.format(new Date(usage.periodEnd)) : null

  function getUsageSummary(limit: number | null, used: number, allowed: boolean = true) {
    if (!allowed) {
      return {
        statusLabel: t("usage.notIncluded"),
        caption: "",
      }
    }

    if (limit === null) {
      return {
        statusLabel: t("usage.unlimited"),
        caption: "",
      }
    }

    const remaining = Math.max(limit - used, 0)

    return {
      statusLabel: `${numberFormatter.format(used)} / ${numberFormatter.format(limit)}`,
      caption: remaining === 0 ? t("usage.limitReached") : t("usage.remaining", { count: remaining }),
    }
  }

  const usageItems: Array<{
    label: string
    used: number
    limit: number | null
    statusLabel: string
    caption: string
    allowed?: boolean
    className?: string
  }> = [
    {
      label: t("usage.transactions"),
      used: usage.transactions.used,
      limit: usage.transactions.limit,
      ...getUsageSummary(usage.transactions.limit, usage.transactions.used),
    },
    {
      label: t("usage.eSignatures"),
      used: usage.eSignatures.used,
      limit: usage.eSignatures.limit,
      ...getUsageSummary(usage.eSignatures.limit, usage.eSignatures.used),
    },
    {
      label: t("usage.qrCodes"),
      used: usage.qrCodes.used,
      limit: usage.qrCodes.limit,
      ...getUsageSummary(usage.qrCodes.limit, usage.qrCodes.used),
    },
    {
      label: t("usage.contractTemplates"),
      used: usage.contractTemplates.used,
      limit: usage.contractTemplates.limit,
      ...getUsageSummary(usage.contractTemplates.limit, usage.contractTemplates.used),
    },
    {
      label: t("usage.kyc"),
      used: usage.kyc.used,
      limit: usage.kyc.limit,
      allowed: usage.kyc.allowed,
      className: "sm:col-span-2",
      ...getUsageSummary(usage.kyc.limit, usage.kyc.used, usage.kyc.allowed),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,248,250,0.96))] px-4 py-4 ring-1 ring-slate-950/[0.05] sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
              <BadgeCheck className="size-4" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {planLabel}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={statusLabel} tone={usage.isTrial ? "info" : getStatusTone(usage.status)} />
                {periodEndLabel ? (
                  <span className="text-xs text-muted-foreground">{t("planUsage.renews", { date: periodEndLabel })}</span>
                ) : null}
              </div>
            </div>
          </div>
          <DashboardRouteLink
            href="/vendor/billing"
            pendingLabel={t("planUsage.manage")}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("planUsage.manage")}
            <ArrowRight className="size-3.5" />
          </DashboardRouteLink>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {usageItems.map((item) => (
          <UsageMeter
            key={item.label}
            label={item.label}
            used={item.used}
            limit={item.limit}
            allowed={item.allowed ?? true}
            statusLabel={item.statusLabel}
            caption={item.caption}
            className={item.className}
          />
        ))}
      </div>
    </div>
  )
}

function ReadinessItem({
  label,
  value,
  complete,
  plain = false,
  className,
}: {
  label: string
  value: string
  complete: boolean
  plain?: boolean
  className?: string
}) {
  const formatStatusLabel = useOverviewStatusLabel()

  return (
    <div
      className={cn(
        "rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,249,251,0.9))] px-4 py-3.5 ring-1 ring-slate-950/[0.05]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ring-1",
              complete
                ? "bg-emerald-500/[0.08] text-emerald-600 ring-emerald-500/[0.14]"
                : "bg-amber-500/[0.08] text-amber-600 ring-amber-500/[0.14]"
            )}
          >
            {complete ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
          </div>
          <p className="pt-0.5 text-sm font-medium leading-5 text-foreground">{label}</p>
        </div>
        <div className="shrink-0">
          {plain ? (
            <span className="text-sm font-medium text-muted-foreground">{value}</span>
          ) : (
            <StatusPill label={formatStatusLabel(value)} tone={getStatusTone(value)} />
          )}
        </div>
      </div>
    </div>
  )
}

function getActivityPresentation(type: VendorOverviewActivityRecord["type"]) {
  switch (type) {
    case "TRANSACTION_RECREATED":
    case "LINK_CREATED":
    case "LINK_OPENED":
      return { icon: Link2, tone: "info" as const, dotClass: "bg-sky-500" }
    case "PROFILE_SUBMITTED":
    case "DOCUMENTS_SUBMITTED":
    case "CUSTOM_FIELDS_SUBMITTED":
      return { icon: Users, tone: "neutral" as const, dotClass: "bg-slate-400" }
    case "KYC_STARTED":
    case "KYC_VERIFIED":
      return { icon: ShieldCheck, tone: "success" as const, dotClass: "bg-emerald-500" }
    case "KYC_FAILED":
      return { icon: ShieldCheck, tone: "danger" as const, dotClass: "bg-red-500" }
    case "CONTRACT_REVIEWED":
    case "SIGNATURE_COMPLETED":
      return { icon: FileSignature, tone: "success" as const, dotClass: "bg-emerald-500" }
    case "SERVICE_PAYMENT_REQUESTED":
    case "SERVICE_PAYMENT_SUCCEEDED":
      return { icon: CreditCard, tone: "info" as const, dotClass: "bg-sky-500" }
    case "DEPOSIT_AUTHORIZED":
    case "DEPOSIT_CAPTURED":
    case "DEPOSIT_RELEASED":
      return { icon: Wallet, tone: "warning" as const, dotClass: "bg-amber-500" }
    case "DISPUTE_OPENED":
    case "TRANSACTION_CANCELLED":
    case "LINK_CANCELLED":
      return { icon: AlertCircle, tone: "danger" as const, dotClass: "bg-red-500" }
    case "COMPLETED":
      return { icon: CheckCircle2, tone: "success" as const, dotClass: "bg-emerald-500" }
    case "TRANSACTION_CREATED":
    default:
      return { icon: Sparkles, tone: "neutral" as const, dotClass: "bg-slate-400" }
  }
}

export function VendorOverview({ workspace, createLinkDialog }: VendorOverviewProps) {
  const t = useTranslations("dashboard.vendor.overview")
  const tPlans = useTranslations("subscriptions.plans")
  const locale = useLocale()
  const formatStatusLabel = useOverviewStatusLabel()
  const formatRecentTransaction = useRecentTransactionLabel()
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [locale]
  )

  const { summary, stats, subscriptionUsage, overviewFlow, overviewActivity } = workspace
  const needsProfileAttention = summary.profileCompletion < 100
  const isReviewApproved = summary.reviewStatus === "APPROVED"
  const isReviewPending = summary.reviewStatus === "PENDING"
  const hasPayoutIssue = summary.stripeConnectionStatus !== "CONNECTED"
  const hasContractTemplate = workspace.contractTemplates.length > 0
  const hasChecklistTemplate = workspace.checklistTemplates.length > 0
  const hasActivePlan = Boolean(subscriptionUsage)
  const readinessTotal = 4
  const readinessScore =
    (summary.profileCompletion === 100 ? 1 : 0) +
    (isReviewApproved ? 1 : 0) +
    (!hasPayoutIssue ? 1 : 0) +
    (hasContractTemplate ? 1 : 0)

  const liveWorkflows =
    overviewFlow.linkSent +
    overviewFlow.customerActive +
    overviewFlow.kycReady +
    overviewFlow.contractReady +
    overviewFlow.signed

  const localizedPlanName =
    subscriptionUsage
      ? (() => {
          const planKey =
            planNameTranslationKeys[
              subscriptionUsage.planSlug as keyof typeof planNameTranslationKeys
            ]
          return planKey ? tPlans(planKey) : subscriptionUsage.planName
        })()
      : null

  const attentionItems = useMemo(() => {
    const items: WorkspaceRecord["alerts"] = []

    if (summary.profileCompletion < 100) {
      items.push({
        title: t("attention.profile.title"),
        description: t("attention.profile.description"),
        tone: "warning",
        href: "/vendor/profile",
        hrefLabel: t("attention.profile.action"),
      })
    }

    if (summary.reviewStatus === "PENDING") {
      items.push({
        title: t("attention.review.title"),
        description: t("attention.review.description"),
        tone: "info",
      })
    }

    if (
      summary.stripeConnectionStatus === "NOT_CONNECTED" ||
      summary.stripeConnectionStatus === "PENDING"
    ) {
      items.push({
        title: t("attention.stripe.title"),
        description: t("attention.stripe.description"),
        tone: "neutral",
        href: "/vendor/stripe",
        hrefLabel: t("attention.stripe.action"),
      })
    }

    return items
  }, [
    summary.profileCompletion,
    summary.reviewStatus,
    summary.stripeConnectionStatus,
    t,
  ])

  const heroState = useMemo(() => {
    if (!hasActivePlan) {
      return {
        primaryAction: "route" as const,
        tone: "warning" as DashboardTone,
        badgeLabel: t("hero.badges.planRequired"),
        title: t("hero.states.planRequired.title", { businessName: summary.businessName }),
        description: t("hero.states.planRequired.description"),
        primaryHref: "/vendor/billing",
        primaryLabel: t("hero.actions.viewBilling"),
      }
    }

    if (needsProfileAttention) {
      return {
        primaryAction: "route" as const,
        tone: "warning" as DashboardTone,
        badgeLabel: t("hero.badges.actionRequired"),
        title: t("hero.states.profile.title", { businessName: summary.businessName }),
        description: t("hero.states.profile.description"),
        primaryHref: "/vendor/profile",
        primaryLabel: t("hero.actions.completeProfile"),
      }
    }

    if (!isReviewApproved) {
      return {
        primaryAction: "route" as const,
        tone: isReviewPending ? "warning" as DashboardTone : "danger" as DashboardTone,
        badgeLabel: isReviewPending ? t("hero.badges.review") : t("hero.badges.actionRequired"),
        title: t("hero.states.review.title", { businessName: summary.businessName }),
        description: t("hero.states.review.description"),
        primaryHref: "/vendor/profile",
        primaryLabel: t("hero.actions.openProfile"),
      }
    }

    if (hasPayoutIssue) {
      return {
        primaryAction: "route" as const,
        tone: "warning" as DashboardTone,
        badgeLabel: t("hero.badges.actionRequired"),
        title: t("hero.states.stripe.title", { businessName: summary.businessName }),
        description: t("hero.states.stripe.description"),
        primaryHref: "/vendor/stripe",
        primaryLabel: t("hero.actions.connectStripe"),
      }
    }

    if (!hasContractTemplate) {
      return {
        primaryAction: "route" as const,
        tone: "info" as DashboardTone,
        badgeLabel: t("hero.badges.setup"),
        title: t("hero.states.contract.title", { businessName: summary.businessName }),
        description: t("hero.states.contract.description"),
        primaryHref: "/vendor/contracts",
        primaryLabel: t("hero.actions.addContract"),
      }
    }

    return {
      primaryAction: "create-link" as const,
      tone: "success" as DashboardTone,
      badgeLabel: t("hero.badges.live"),
      title: t("hero.states.ready.title", { businessName: summary.businessName }),
      description: t("hero.states.ready.description"),
      primaryLabel: t("hero.actions.createLink"),
    }
  }, [
    hasActivePlan,
    hasContractTemplate,
    hasPayoutIssue,
    isReviewApproved,
    isReviewPending,
    needsProfileAttention,
    summary.businessName,
    t,
  ])

  const heroSnapshots = [
    {
      label: t("planUsage.title"),
      value: localizedPlanName ?? t("noActivePlan.title"),
      tone: subscriptionUsage ? "info" as DashboardTone : "warning" as DashboardTone,
    },
    {
      label: t("reviewStatus"),
      value: formatStatusLabel(summary.reviewStatus),
      tone: getStatusTone(summary.reviewStatus),
    },
    {
      label: t("payoutSetup"),
      value: formatStatusLabel(summary.stripeConnectionStatus),
      tone: getStatusTone(summary.stripeConnectionStatus),
    },
  ]

  const currencyFormatter = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const totalDepositDecisions = stats.depositCaptureCount + stats.depositReleaseCount
  const captureRate = totalDepositDecisions > 0
    ? Math.round((stats.depositCaptureCount / totalDepositDecisions) * 100)
    : null

  const metricCards = [
    {
      label: t("hero.metrics.solde.label"),
      value: currencyFormatter.format(stats.serviceRevenue / 100),
      detail: t("hero.metrics.solde.detail", { count: overviewFlow.completed }),
      icon: TrendingUp,
      href: "/vendor/transactions",
    },
    {
      label: t("hero.metrics.transactions.label"),
      value: numberFormatter.format(stats.totalTransactions),
      detail: t("hero.metrics.transactions.detail", { live: liveWorkflows }),
      icon: ArrowRightLeft,
      href: "/vendor/transactions",
    },
    {
      label: t("hero.metrics.depositsCaptured.label"),
      value: currencyFormatter.format(stats.depositsCaptured / 100),
      detail: captureRate !== null
        ? t("hero.metrics.depositsCaptured.detailWithRate", { rate: captureRate })
        : t("hero.metrics.depositsCaptured.detail"),
      icon: Wallet,
      href: "/vendor/deposits",
    },
    {
      label: t("hero.metrics.depositsReleased.label"),
      value: currencyFormatter.format(stats.depositsReleased / 100),
      detail: t("hero.metrics.depositsReleased.detail", { count: stats.depositReleaseCount }),
      icon: Unlock,
      href: "/vendor/deposits",
    },
  ]

  const pipelineCards = [
    {
      label: t("pipeline.stages.linkSent"),
      value: numberFormatter.format(overviewFlow.linkSent),
      detail: t("pipeline.details.linkSent"),
      icon: Link2,
      tone: "info" as DashboardTone,
    },
    {
      label: t("pipeline.stages.customerActive"),
      value: numberFormatter.format(overviewFlow.customerActive),
      detail: t("pipeline.details.customerActive"),
      icon: Users,
      tone: "neutral" as DashboardTone,
    },
    {
      label: t("pipeline.stages.kycReady"),
      value: numberFormatter.format(overviewFlow.kycReady),
      detail: t("pipeline.details.kycReady"),
      icon: ShieldCheck,
      tone: "success" as DashboardTone,
    },
    {
      label: t("pipeline.stages.completed"),
      value: numberFormatter.format(overviewFlow.completed),
      detail: t("pipeline.details.completed"),
      icon: CheckCircle2,
      tone: "success" as DashboardTone,
    },
  ]

  function getActivityLabel(type: VendorOverviewActivityRecord["type"]) {
    switch (type) {
      case "TRANSACTION_RECREATED":
        return t("activity.labels.TRANSACTION_RECREATED")
      case "LINK_CREATED":
        return t("activity.labels.LINK_CREATED")
      case "LINK_OPENED":
        return t("activity.labels.LINK_OPENED")
      case "PROFILE_SUBMITTED":
        return t("activity.labels.PROFILE_SUBMITTED")
      case "DOCUMENTS_SUBMITTED":
        return t("activity.labels.DOCUMENTS_SUBMITTED")
      case "CUSTOM_FIELDS_SUBMITTED":
        return t("activity.labels.CUSTOM_FIELDS_SUBMITTED")
      case "KYC_STARTED":
        return t("activity.labels.KYC_STARTED")
      case "KYC_VERIFIED":
        return t("activity.labels.KYC_VERIFIED")
      case "KYC_FAILED":
        return t("activity.labels.KYC_FAILED")
      case "CONTRACT_REVIEWED":
        return t("activity.labels.CONTRACT_REVIEWED")
      case "SIGNATURE_COMPLETED":
        return t("activity.labels.SIGNATURE_COMPLETED")
      case "SERVICE_PAYMENT_REQUESTED":
        return t("activity.labels.SERVICE_PAYMENT_REQUESTED")
      case "SERVICE_PAYMENT_SUCCEEDED":
        return t("activity.labels.SERVICE_PAYMENT_SUCCEEDED")
      case "DEPOSIT_AUTHORIZED":
        return t("activity.labels.DEPOSIT_AUTHORIZED")
      case "DEPOSIT_CAPTURED":
        return t("activity.labels.DEPOSIT_CAPTURED")
      case "DEPOSIT_RELEASED":
        return t("activity.labels.DEPOSIT_RELEASED")
      case "DISPUTE_OPENED":
        return t("activity.labels.DISPUTE_OPENED")
      case "TRANSACTION_CANCELLED":
        return t("activity.labels.TRANSACTION_CANCELLED")
      case "LINK_CANCELLED":
        return t("activity.labels.LINK_CANCELLED")
      case "COMPLETED":
        return t("activity.labels.COMPLETED")
      case "TRANSACTION_CREATED":
      default:
        return t("activity.labels.TRANSACTION_CREATED")
    }
  }

  const readinessPercent = Math.round((readinessScore / readinessTotal) * 100)
  const recentTransactions = workspace.transactions.slice(0, 5)

  return (
    <div className="space-y-6 xl:space-y-7">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          surfaceClass,
          "relative px-5 py-5 sm:px-6 sm:py-5 lg:px-7"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(17,201,176,0.13),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.05),transparent_30%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_300px] xl:items-start">
          <div className="space-y-4">
            <div className="space-y-2.5">
              <StatusPill label={heroState.badgeLabel} tone={heroState.tone} />
              <div className="space-y-2">
                <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  {t("hero.eyebrow")}
                </p>
                <h1 className="max-w-3xl font-sans text-[2rem] font-semibold tracking-tight text-foreground sm:text-[2.35rem]">
                  {heroState.title}
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {heroState.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {heroState.primaryAction === "create-link" ? (
                <>
                  <VendorCreateLinkDialog
                    contracts={createLinkDialog.contracts}
                    checklists={createLinkDialog.checklists}
                    usage={createLinkDialog.usage}
                    hasStripe={createLinkDialog.hasStripe}
                    canLaunch={createLinkDialog.canLaunch}
                    blockedMessage={createLinkDialog.blockedMessage}
                    renderTrigger={({ openDialog, disabled, blockedReason }) => (
                      <Button
                        type="button"
                        className="h-10 cursor-pointer rounded-xl bg-[var(--contrazy-teal)] px-4 text-white shadow-[0_12px_26px_-16px_rgba(17,201,176,0.5)] hover:bg-[#0eb8a0] disabled:bg-muted disabled:text-muted-foreground"
                        onClick={openDialog}
                        disabled={disabled}
                        title={blockedReason ?? undefined}
                      >
                        {heroState.primaryLabel}
                      </Button>
                    )}
                  />
                  <VendorCreateLinkDialog
                    contracts={createLinkDialog.contracts}
                    checklists={createLinkDialog.checklists}
                    mode="bulk"
                    usage={createLinkDialog.usage}
                    hasStripe={createLinkDialog.hasStripe}
                    canLaunch={createLinkDialog.canLaunch}
                    blockedMessage={createLinkDialog.blockedMessage}
                    renderTrigger={({ openDialog, disabled, blockedReason }) => (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 cursor-pointer rounded-xl border-border bg-white/80 px-4 text-foreground shadow-sm hover:bg-white disabled:bg-muted disabled:text-muted-foreground"
                        onClick={openDialog}
                        disabled={disabled}
                        title={blockedReason ?? undefined}
                      >
                        <Users className="mr-2 size-4" />
                        {t("hero.bulkCsv")}
                      </Button>
                    )}
                  />
                </>
              ) : (
                <DashboardRouteLink
                  href={heroState.primaryHref}
                  pendingLabel={heroState.primaryLabel}
                  className={buttonVariants({
                    className:
                      "h-10 rounded-xl bg-[var(--contrazy-teal)] px-4 text-white shadow-[0_12px_26px_-16px_rgba(17,201,176,0.5)] hover:bg-[#0eb8a0]",
                  })}
                >
                  {heroState.primaryLabel}
                </DashboardRouteLink>
              )}
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/[0.035] px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-slate-950/[0.05]">
                <span className="size-2 rounded-full bg-[var(--contrazy-teal)]" />
                {t("stepsComplete", { n: readinessScore, total: readinessTotal })}
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {heroSnapshots.map((item) => (
              <HeroSnapshotItem key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
            <div className="rounded-2xl bg-white/74 px-4 py-3.5 ring-1 ring-slate-950/[0.05]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{t("businessReadiness.title")}</span>
                <span className="text-sm font-semibold text-foreground">{readinessPercent}%</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-900/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${readinessPercent}%` }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-[var(--contrazy-teal)] to-[#56d8c5]"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <AttentionRail items={attentionItems} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => (
          <MetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            detail={item.detail}
            icon={item.icon}
            href={item.href}
          />
        ))}
      </div>

      <SectionShell
        title={t("pipeline.title")}
        actionHref="/vendor/transactions"
        actionLabel={t("pipeline.open")}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={t("pipeline.flags.disputed", { count: overviewFlow.disputed })}
              tone={overviewFlow.disputed > 0 ? "danger" : "neutral"}
            />
            <StatusPill
              label={t("pipeline.flags.cancelled", { count: overviewFlow.cancelled })}
              tone={overviewFlow.cancelled > 0 ? "warning" : "neutral"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pipelineCards.map((item) => (
              <PipelineCard
                key={item.label}
                label={item.label}
                value={item.value}
                detail={item.detail}
                icon={item.icon}
                tone={item.tone}
              />
            ))}
          </div>
        </div>
      </SectionShell>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
        <SectionShell
          title={t("planUsage.title")}
          actionHref="/vendor/billing"
          actionLabel={t("planUsage.billing")}
          className="xl:self-start"
        >
          {subscriptionUsage ? (
            <PlanUsageSection usage={subscriptionUsage} locale={locale} />
          ) : (
            <EmptyState
              icon={BadgeCheck}
              title={t("noActivePlan.title")}
              description={t("noActivePlan.description")}
              actionHref="/vendor/billing"
              actionLabel={t("noActivePlan.viewPlans")}
            />
          )}
        </SectionShell>

        <SectionShell title={t("businessReadiness.title")}>
          <div className="space-y-3">
            <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,248,250,0.96))] px-4 py-4 ring-1 ring-slate-950/[0.05]">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {readinessScore === readinessTotal ? t("readyToGoLive") : t("stepsComplete", { n: readinessScore, total: readinessTotal })}
                  </p>
                  <p className="text-xs text-muted-foreground">{summary.businessName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-semibold tracking-tight text-foreground">{readinessPercent}%</p>
                  <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    {t("businessReadiness.title")}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-900/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${readinessPercent}%` }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-[var(--contrazy-teal)] to-[#56d8c5]"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ReadinessItem
                label={t("businessReadiness.items.profile")}
                value={`${summary.profileCompletion}%`}
                complete={summary.profileCompletion === 100}
                plain
              />
              <ReadinessItem
                label={t("businessReadiness.items.review")}
                value={summary.reviewStatus}
                complete={isReviewApproved}
              />
              <ReadinessItem
                label={t("businessReadiness.items.stripe")}
                value={summary.stripeConnectionStatus}
                complete={!hasPayoutIssue}
              />
              <ReadinessItem
                label={t("businessReadiness.items.contracts")}
                value={
                  hasContractTemplate
                    ? t("businessReadiness.states.templatesReady", {
                        count: workspace.contractTemplates.length,
                      })
                    : t("businessReadiness.states.templatesMissing")
                }
                complete={hasContractTemplate}
                plain
              />
              <ReadinessItem
                label={t("businessReadiness.items.requirements")}
                value={
                  hasChecklistTemplate
                    ? t("businessReadiness.states.requirementsReady", {
                        count: workspace.checklistTemplates.length,
                      })
                    : t("businessReadiness.states.requirementsOptional")
                }
                complete={hasChecklistTemplate}
                plain
                className="sm:col-span-2"
              />
            </div>
          </div>
        </SectionShell>
      </div>

      <SectionShell
        title={t("activity.title")}
        actionHref="/vendor/webhooks"
        actionLabel={t("activity.openEvents")}
      >
        {overviewActivity.length > 0 ? (
          <div className="relative">
            <div className="absolute left-4 top-3 bottom-3 w-px bg-gradient-to-b from-[var(--contrazy-teal)]/30 via-slate-300/60 to-transparent" />
            <div className="space-y-3">
              {overviewActivity.slice(0, 6).map((item) => {
                const presentation = getActivityPresentation(item.type)
                const Icon = presentation.icon

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="relative pl-10"
                  >
                    <span
                      className={cn(
                        "absolute left-[9px] top-3.5 size-3.5 rounded-full border-[3px] border-white ring-1 ring-slate-950/[0.06]",
                        presentation.dotClass
                      )}
                    />
                    <div className="grid gap-3 rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,249,251,0.9))] px-4 py-3.5 ring-1 ring-slate-950/[0.05] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 items-center justify-center rounded-xl bg-white text-foreground ring-1 ring-slate-950/[0.05]">
                            <Icon className="size-4" />
                          </div>
                          <p className="font-medium text-foreground">{getActivityLabel(item.type)}</p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{item.transactionTitle || t("activity.untitledWorkflow")}</span>
                          <span className="text-slate-300">•</span>
                          <span>{t("activity.reference", { reference: item.reference })}</span>
                          {item.clientName ? (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>{item.clientName}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <span className="text-xs text-muted-foreground">
                          {dateTimeFormatter.format(new Date(item.occurredAt))}
                        </span>
                        <DashboardRouteLink
                          href={`/vendor/transactions/${item.transactionId}`}
                          pendingLabel={t("activity.openTransaction")}
                          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--contrazy-teal)] transition-colors hover:text-[#0eb8a0]"
                        >
                          {t("activity.openTransaction")}
                          <ArrowRight className="size-3.5" />
                        </DashboardRouteLink>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title={t("activity.emptyTitle")}
            description={t("activity.emptyDescription")}
          />
        )}
      </SectionShell>

      <SectionShell
        title={t("recentTransactions.title")}
        actionHref="/vendor/transactions"
        actionLabel={t("recentTransactions.allTransactions")}
      >
        {recentTransactions.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,249,251,0.9))] px-4 py-4 ring-1 ring-slate-950/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/vendor/transactions/${transaction.id}`}
                        className="font-medium text-foreground transition-colors hover:text-[var(--contrazy-teal)]"
                      >
                        {transaction.reference}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{transaction.clientName}</p>
                      <p className="text-xs text-muted-foreground">{transaction.clientEmail}</p>
                    </div>
                    <StatusBadge tone={getStatusTone(transaction.status)}>
                      {formatRecentTransaction.status(transaction.status)}
                    </StatusBadge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("table.amount")}</p>
                      <p className="mt-1 font-medium text-foreground">{transaction.amount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("table.date")}</p>
                      <p className="mt-1 font-medium text-foreground">{transaction.date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("table.type")}</p>
                      <p className="mt-1 font-medium text-foreground">
                        {formatRecentTransaction.kind(transaction.kind)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <StatusBadge tone={getStatusTone(transaction.kyc)}>
                        {formatRecentTransaction.kyc(transaction.kyc)}
                      </StatusBadge>
                      <StatusBadge tone={getStatusTone(transaction.contract)}>
                        {formatRecentTransaction.contract(transaction.contract)}
                      </StatusBadge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-[22px] ring-1 ring-slate-950/[0.05] md:block">
              <Table>
                <TableHeader className="bg-slate-900/[0.02]">
                  <TableRow className="border-slate-950/[0.06] hover:bg-transparent">
                    <TableHead className="px-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {t("table.client")}
                    </TableHead>
                    <TableHead className="px-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {t("table.reference")}
                    </TableHead>
                    <TableHead className="px-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {t("table.type")}
                    </TableHead>
                    <TableHead className="px-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {t("table.amount")}
                    </TableHead>
                    <TableHead className="px-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {t("table.kyc")}
                    </TableHead>
                    <TableHead className="px-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {t("table.contract")}
                    </TableHead>
                    <TableHead className="px-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {t("table.status")}
                    </TableHead>
                    <TableHead className="px-4 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      {t("table.date")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      className="border-slate-950/[0.05] hover:bg-slate-900/[0.025]"
                    >
                      <TableCell className="px-4 py-3.5">
                        <div>
                          <p className="font-medium text-foreground">{transaction.clientName}</p>
                          <p className="text-xs text-muted-foreground">{transaction.clientEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <Link
                          href={`/vendor/transactions/${transaction.id}`}
                          className="font-medium text-foreground transition-colors hover:text-[var(--contrazy-teal)]"
                        >
                          {transaction.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground">
                        {formatRecentTransaction.kind(transaction.kind)}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 font-medium text-foreground">{transaction.amount}</TableCell>
                      <TableCell className="px-4 py-3.5">
                        <StatusBadge tone={getStatusTone(transaction.kyc)}>
                          {formatRecentTransaction.kyc(transaction.kyc)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <StatusBadge tone={getStatusTone(transaction.contract)}>
                          {formatRecentTransaction.contract(transaction.contract)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-4 py-3.5">
                        <StatusBadge tone={getStatusTone(transaction.status)}>
                          {formatRecentTransaction.status(transaction.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-muted-foreground">{transaction.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={CreditCard}
            title={t("recentTransactions.title")}
            description={t("noWorkflows")}
          />
        )}
      </SectionShell>
    </div>
  )
}
