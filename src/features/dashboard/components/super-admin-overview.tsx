import Link from "next/link"

import {
  DashboardTable,
  KpiGrid,
  PagePanel,
  StatusBadge,
} from "@/features/dashboard/components/dashboard-ui"
import type { AdminWorkspaceRecord } from "@/features/dashboard/server/dashboard-data"
import { getDemoTone } from "@/features/dashboard/server/dashboard-data"

type SuperAdminOverviewProps = {
  email: string
  workspace: AdminWorkspaceRecord
}

export function SuperAdminOverview({ email, workspace }: SuperAdminOverviewProps) {
  return (
    <div className="space-y-6">
      <KpiGrid items={workspace.kpis} />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <PagePanel
          title="Vendor review queue"
          description="Review business approval status, payout readiness, and recent vendor accounts."
          actionHref="/admin/users"
          actionLabel="All users"
        >
          <DashboardTable
            columns={["Business", "Email", "Review", "Stripe"]}
            rows={workspace.vendors.map((vendor) => [
              <Link
                key={`${vendor.id}-business`}
                href={`/admin/users/${vendor.userId}`}
                className="font-medium text-foreground hover:text-[var(--contrazy-teal)]"
              >
                {vendor.businessName}
              </Link>,
              vendor.businessEmail,
              <StatusBadge key={`${vendor.id}-review`} tone={getDemoTone(vendor.reviewStatus)}>
                {vendor.reviewStatus}
              </StatusBadge>,
              <StatusBadge key={`${vendor.id}-stripe`} tone={getDemoTone(vendor.stripeConnectionStatus)}>
                {vendor.stripeConnectionStatus}
              </StatusBadge>,
            ])}
            emptyMessage="No vendor accounts are waiting for review."
          />
        </PagePanel>

        <PagePanel title="Admin scope" description="Current operator details and the main access levels in use.">
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-medium text-foreground">Active operator</p>
              <p className="mt-2 text-muted-foreground">{email}</p>
            </div>
            {workspace.rolePolicies.slice(0, 3).map((policy) => (
              <div key={policy.title} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{policy.title}</p>
                  {policy.tag ? <StatusBadge tone="neutral">{policy.tag}</StatusBadge> : null}
                </div>
                <p className="mt-2 text-muted-foreground">{policy.description}</p>
              </div>
            ))}
          </div>
        </PagePanel>
      </div>
    </div>
  )
}
