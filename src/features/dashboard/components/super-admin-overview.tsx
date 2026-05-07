import Link from "next/link"
import { getTranslations } from "next-intl/server"

import {
  DashboardTable,
  KpiGrid,
  PagePanel,
  StatusBadge,
} from "@/features/dashboard/components/dashboard-ui"
import {
  AdminBillingIntervalChart,
  AdminPlanBreakdownTable,
  AdminPlanDistributionChart,
  AdminRevenueTrendChart,
  AdminSubscriptionTrendChart,
  AdminTransactionVolumeTrendChart,
} from "@/features/dashboard/components/admin-analytics-charts"
import type { AdminAnalyticsData, AdminWorkspaceRecord } from "@/features/dashboard/server/dashboard-data"
import { getStatusTone } from "@/features/dashboard/server/dashboard-data"

type SuperAdminOverviewProps = {
  email: string
  workspace: AdminWorkspaceRecord
  analytics: AdminAnalyticsData
}

function formatEur(cents: number) {
  return `€${(cents / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`
}

export async function SuperAdminOverview({ email, workspace, analytics }: SuperAdminOverviewProps) {
  const t = await getTranslations("dashboard.admin.overview")

  const analyticsKpis = [
    {
      label: t("kpiFeesCollected"),
      value: formatEur(analytics.totalPlatformFeeCents),
      detail: t("kpiFeesDetail", { count: analytics.totalDepositCaptureCount }),
      tone: analytics.totalPlatformFeeCents > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      label: t("kpiMrr"),
      value: `${formatEur(analytics.estimatedMrr)}/mo`,
      detail: t("kpiMrrDetail"),
      tone: analytics.estimatedMrr > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      label: t("kpiActiveSubscribers"),
      value: `${analytics.activeSubscriberCount}`,
      detail:
        analytics.trialingCount > 0
          ? t("kpiActiveSubscribersDetail", { count: analytics.trialingCount })
          : t("kpiActiveSubscribersNone"),
      tone: analytics.activeSubscriberCount > 0 ? ("success" as const) : ("neutral" as const),
    },
    {
      label: t("kpiTxVolume"),
      value: formatEur(analytics.totalServiceVolumeCents),
      detail: t("kpiTxVolumeDetail"),
      tone: "neutral" as const,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Revenue KPI strip */}
      <KpiGrid items={analyticsKpis} />

      {/* Main revenue trend charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <AdminRevenueTrendChart data={analytics.monthlyTrend} />
        <AdminTransactionVolumeTrendChart data={analytics.monthlyTrend} />
      </div>

      {/* Subscription analytics */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
        <AdminPlanDistributionChart data={analytics.planBreakdown} />
        <AdminBillingIntervalChart data={analytics.billingIntervalSplit} />
        <AdminSubscriptionTrendChart data={analytics.monthlyTrend} />
      </div>

      {/* Revenue by plan table + operational KPIs */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <AdminPlanBreakdownTable data={analytics.planBreakdown} />

        {/* Operational summary KPIs */}
        <div className="grid gap-3 content-start sm:grid-cols-2 xl:grid-cols-1">
          {[
            {
              label: t("kpiVendors"),
              value: `${workspace.vendors.length}`,
              detail: t("kpiVendorsDetail"),
              tone: "neutral" as const,
            },
            {
              label: t("kpiPending"),
              value: `${workspace.vendors.filter((v) => v.reviewStatus === "PENDING").length}`,
              detail:
                workspace.vendors.filter((v) => v.reviewStatus === "PENDING").length > 0
                  ? t("kpiPendingWaiting")
                  : t("kpiPendingNone"),
              tone:
                workspace.vendors.filter((v) => v.reviewStatus === "PENDING").length > 0
                  ? ("warning" as const)
                  : ("neutral" as const),
            },
            {
              label: t("kpiConnected"),
              value: `${workspace.vendors.filter((v) => v.stripeConnectionStatus === "CONNECTED").length}`,
              detail: t("kpiConnectedDetail"),
              tone: "neutral" as const,
            },
            {
              label: t("kpiUsers"),
              value: `${workspace.users.length}`,
              detail: t("kpiUsersDetail"),
              tone: "neutral" as const,
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Vendor queue */}
      <PagePanel
        title={t("vendorQueueTitle")}
        description={t("vendorQueueDesc")}
        actionHref="/admin/users"
        actionLabel={t("allUsers")}
      >
        <DashboardTable
          columns={[t("thBusiness"), t("thEmail"), t("thReview"), t("thStripe")]}
          rows={workspace.vendors.map((vendor) => [
            <Link
              key={`${vendor.id}-business`}
              href={`/admin/users/${vendor.userId}`}
              className="font-medium text-foreground hover:text-(--contrazy-teal)"
            >
              {vendor.businessName}
            </Link>,
            vendor.businessEmail,
            <StatusBadge key={`${vendor.id}-review`} tone={getStatusTone(vendor.reviewStatus)}>
              {vendor.reviewStatus}
            </StatusBadge>,
            <StatusBadge key={`${vendor.id}-stripe`} tone={getStatusTone(vendor.stripeConnectionStatus)}>
              {vendor.stripeConnectionStatus}
            </StatusBadge>,
          ])}
          emptyMessage={t("emptyQueue")}
        />
      </PagePanel>
    </div>
  )
}
