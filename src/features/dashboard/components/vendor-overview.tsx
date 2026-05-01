import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import {
  AlertStrip,
  DashboardTable,
  KpiGrid,
  PagePanel,
  StatusBadge,
} from "@/features/dashboard/components/dashboard-ui"
import type { WorkspaceRecord } from "@/features/dashboard/server/dashboard-data"
import { getDemoTone } from "@/features/dashboard/server/dashboard-data"

type VendorOverviewProps = {
  workspace: WorkspaceRecord
}

export function VendorOverview({ workspace }: VendorOverviewProps) {
  const needsProfileAttention = workspace.summary.profileCompletion < 100

  return (
    <div className="space-y-6">
      <AlertStrip items={workspace.alerts} />

      <KpiGrid items={workspace.kpis} />

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <PagePanel
          title="Latest transactions"
          description={`${workspace.summary.businessName} customer activity in one clear working view.`}
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
              <Link key={`${transaction.reference}-link`} href={`/vendor/transactions/${transaction.id}`} className="font-medium text-foreground hover:text-[var(--contrazy-teal)]">
                {transaction.reference}
              </Link>,
              transaction.kind,
              transaction.amount,
              <StatusBadge key={`${transaction.reference}-kyc`} tone={getDemoTone(transaction.kyc)}>
                {transaction.kyc}
              </StatusBadge>,
              <StatusBadge key={`${transaction.reference}-contract`} tone={getDemoTone(transaction.contract)}>
                {transaction.contract}
              </StatusBadge>,
              <StatusBadge key={`${transaction.reference}-status`} tone={getDemoTone(transaction.status)}>
                {transaction.status}
              </StatusBadge>,
              transaction.date,
            ])}
            emptyMessage="No customer workflows have been created yet."
          />
        </PagePanel>

        <PagePanel title="Business status" description="Keep your business details, review status, and payouts ready for launch.">
          <div className="space-y-4 text-sm">
            <StatusRow label="Profile completion" value={`${workspace.summary.profileCompletion}%`} plain />
            <StatusRow label="Review status" value={workspace.summary.reviewStatus} />
            <StatusRow label="Payout setup" value={workspace.summary.stripeConnectionStatus} />
            <StatusRow label="Support email" value={workspace.summary.supportEmail} plain />
            <div className="rounded-lg bg-muted p-4">
              <p className="font-medium text-foreground">Current workspace</p>
              <p className="mt-2 text-muted-foreground">
                {workspace.summary.businessName} · {workspace.summary.businessCountry}
              </p>
            </div>
            <Link
              href={needsProfileAttention ? "/vendor/profile" : "/vendor/actions"}
              className={buttonVariants({
                className: "h-10 w-full bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]",
              })}
            >
              {needsProfileAttention ? "Complete business profile" : "Open action queue"}
            </Link>
          </div>
        </PagePanel>
      </div>
    </div>
  )
}

function StatusRow({ label, value, plain = false }: { label: string; value: string; plain?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      {plain ? (
        <span className="text-right font-medium text-foreground">{value}</span>
      ) : (
        <StatusBadge tone={getDemoTone(value)}>{value}</StatusBadge>
      )}
    </div>
  )
}
