"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import type { ChecklistTemplate, ContractTemplate } from "@prisma/client"
import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Plus,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DashboardTable, PagePanel, StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import { PaymentLinkManagementActions } from "@/features/dashboard/components/payment-link-management-actions"
import { TransactionCreationForm } from "@/features/dashboard/components/transaction-creation-form"
import { DashboardRouteLink } from "@/features/dashboard/components/dashboard-route-link"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import type {
  VendorActionsUsageRecord,
  VendorLinkRecord,
} from "@/features/dashboard/server/dashboard-data"
import { cn } from "@/lib/utils"

type VendorLinkWorkspaceProps = {
  contracts: ContractTemplate[]
  checklists: ChecklistTemplate[]
  usage: VendorActionsUsageRecord | null
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  initialLinks: VendorLinkRecord[]
}

function isLiveStatus(status: string) {
  return status === "ACTIVE" || status === "PROCESSING"
}

function formatRemaining(limit: number | null, remaining: number | null) {
  if (limit === null) {
    return "Unlimited"
  }

  return `${remaining ?? 0} left`
}

function formatPeriodEnd(value: string | null) {
  if (!value) {
    return "Current period"
  }

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
  const [recentLinks, setRecentLinks] = useState(initialLinks)
  const [usageState, setUsageState] = useState(usage)
  const [createOpen, setCreateOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [createDirty, setCreateDirty] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [formInstance, setFormInstance] = useState(0)

  const activeCount = recentLinks.filter((item) => item.status === "ACTIVE").length
  const processingCount = recentLinks.filter((item) => item.status === "PROCESSING").length
  const transactionLimitReached =
    usageState?.transactions.remaining !== null &&
    (usageState?.transactions.remaining ?? 0) <= 0
  const createBlockedMessage = !canLaunch
    ? blockedMessage
    : !hasStripe
      ? "Connect Stripe before creating live customer transactions."
      : transactionLimitReached
        ? "Your monthly transaction quota is fully used for this billing period."
        : null

  const headerWarnings = useMemo(() => {
    const warnings: Array<{ title: string; detail: string }> = []

    if (!canLaunch) {
      warnings.push({
        title: "Vendor review required",
        detail: blockedMessage,
      })
    }

    if (!hasStripe) {
      warnings.push({
        title: "Stripe setup required",
        detail: "Connect Stripe before creating secure payment and deposit flows.",
      })
    }

    if (transactionLimitReached) {
      warnings.push({
        title: "Transaction quota reached",
        detail: "Upgrade your plan or wait for the next billing period to launch new transactions.",
      })
    }

    return warnings
  }, [blockedMessage, canLaunch, hasStripe, transactionLimitReached])

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

  function forceCloseCreate() {
    setCreateOpen(false)
    setDiscardOpen(false)
    setCreateDirty(false)
    setCreateSuccess(false)
    setFormInstance((current) => current + 1)
  }

  function handleCreateOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setCreateOpen(true)
      return
    }

    if (createDirty && !createSuccess) {
      setDiscardOpen(true)
      return
    }

    forceCloseCreate()
  }

  const statusLabel = usageState?.isTrial
    ? "Trial"
    : usageState?.status
      ? usageState.status.charAt(0) + usageState.status.slice(1).toLowerCase()
      : "Active"

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
                {usageState ? `${usageState.planName} plan` : "Active plan"}
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Transactions and live sharing</h2>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
                  Launch a secure link first, then add QR only when the workflow needs in-person sharing.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/80 bg-background/80 px-3 py-1">
                  {statusLabel}
                </span>
                <span className="rounded-full border border-border/80 bg-background/80 px-3 py-1">
                  Renews {formatPeriodEnd(usageState?.periodEnd ?? null)}
                </span>
                <span className="rounded-full border border-border/80 bg-background/80 px-3 py-1">
                  {activeCount} active · {processingCount} processing
                </span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2.5 sm:flex-row xl:w-auto xl:justify-end">
              <DashboardRouteLink
                href="/vendor/billing"
                pendingLabel="Billing"
                className="inline-flex items-center justify-center rounded-2xl border border-border/80 bg-background/90 px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-background"
              >
                Plan & usage
                <ArrowUpRight className="size-4" />
              </DashboardRouteLink>
              <Button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--contrazy-teal)] px-4 text-sm font-semibold text-slate-950 hover:bg-[var(--contrazy-teal)]/90 disabled:bg-muted disabled:text-muted-foreground"
                onClick={() => setCreateOpen(true)}
                disabled={Boolean(createBlockedMessage)}
              >
                <Plus className="size-4" />
                New Transaction
              </Button>
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
              label="Transactions"
              value={formatRemaining(usageState?.transactions.limit ?? null, usageState?.transactions.remaining ?? null)}
              detail={
                usageState?.transactions.limit === null
                  ? `${usageState?.transactions.used ?? 0} launched this period`
                  : `${usageState?.transactions.used ?? 0} / ${usageState?.transactions.limit ?? 0} used`
              }
              tone={transactionLimitReached ? "danger" : "accent"}
              icon={CreditCard}
            />
            <UsageCard
              label="QR Codes"
              value={formatRemaining(usageState?.qrCodes.limit ?? null, usageState?.qrCodes.remaining ?? null)}
              detail={
                usageState?.qrCodes.limit === null
                  ? `${usageState?.qrCodes.used ?? 0} generated this period`
                  : `${usageState?.qrCodes.used ?? 0} / ${usageState?.qrCodes.limit ?? 0} generated`
              }
              tone={
                usageState?.qrCodes.remaining !== null && (usageState?.qrCodes.remaining ?? 0) <= 0
                  ? "warning"
                  : "default"
              }
              icon={QrCode}
            />
            <UsageCard
              label="KYC"
              value={
                usageState?.kyc.allowed
                  ? formatRemaining(usageState?.kyc.limit ?? null, usageState?.kyc.remaining ?? null)
                  : "Unavailable"
              }
              detail={
                !usageState?.kyc.allowed
                  ? "Available from Pro plan."
                  : usageState?.kyc.limit === null
                    ? `${usageState?.kyc.used ?? 0} verification requests`
                    : `${usageState?.kyc.used ?? 0} / ${usageState?.kyc.limit ?? 0} used`
              }
              tone={usageState?.kyc.allowed ? "default" : "warning"}
              icon={ShieldCheck}
            />
          </div>
        </div>
      </motion.section>

      <PagePanel
        title="Recent payment links"
        description="Active and in-progress customer links stay here so you can copy, edit, cancel, or add QR later."
        actionHref="/vendor/links"
        actionLabel="Open full manager"
      >
        <div className="overflow-hidden rounded-xl border">
          <DashboardTable
            columns={["Reference", "Client", "Title", "Amount", "Last activity", "Status", "Actions"]}
            rows={recentLinks.map((record) => [
              <Link
                key={`${record.id}-reference`}
                href={`/vendor/transactions/${record.transactionId}`}
                className="font-medium text-foreground hover:text-[var(--contrazy-teal)]"
              >
                {record.reference}
              </Link>,

              <div key={`${record.id}-client`} className="min-w-[150px]">
                <p className="font-medium text-foreground">{record.clientName}</p>
                <p className="text-xs text-muted-foreground">{record.clientEmail}</p>
              </div>,

              <div key={`${record.id}-title`} className="min-w-[200px]">
                <p className="font-medium text-foreground">{record.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">{record.kind.replaceAll("_", " ").toLowerCase()}</span>
                  {record.qrReady ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      <CheckCircle2 className="size-3" />
                      QR ready
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5">
                      Link only
                    </span>
                  )}
                </div>
              </div>,

              <div key={`${record.id}-amounts`} className="space-y-0.5">
                {record.kind !== "DEPOSIT" && (
                  <p className="text-sm font-medium text-foreground">{record.serviceAmount}</p>
                )}
                {record.kind !== "PAYMENT" && (
                  <p className="text-xs text-muted-foreground">Hold: {record.depositAmount}</p>
                )}
              </div>,

              <span key={`${record.id}-last-activity`} className="text-sm text-muted-foreground">
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
            emptyMessage="No active or processing links are waiting right now."
          />
        </div>
      </PagePanel>

      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent
          className="h-[100dvh] max-w-none overflow-hidden rounded-none border-0 bg-background p-0 shadow-none ring-0 sm:h-auto sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-[28px] sm:border sm:border-border/70 sm:shadow-[0_32px_80px_-40px_rgba(15,23,42,0.45)]"
          showCloseButton={false}
        >
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="border-b border-border/70 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-semibold tracking-tight">New transaction</DialogTitle>
                  <DialogDescription className="mt-1 text-sm">
                    Create the secure link, configure the client journey, and decide whether this workflow needs a QR.
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  onClick={() => handleCreateOpenChange(false)}
                >
                  <X className="size-4" />
                  <span className="sr-only">Close transaction modal</span>
                </Button>
              </div>
            </DialogHeader>

            {createOpen ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <TransactionCreationForm
                  key={formInstance}
                  contracts={contracts}
                  checklists={checklists}
                  usage={usageState}
                  hasStripe={hasStripe}
                  canLaunch={canLaunch}
                  blockedMessage={blockedMessage}
                  onLinkCreated={handleCreatedLink}
                  onDirtyChange={setCreateDirty}
                  onSuccessStateChange={setCreateSuccess}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard transaction setup?</DialogTitle>
            <DialogDescription>
              Your current progress inside the transaction modal will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button type="button" variant="destructive" onClick={forceCloseCreate}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
