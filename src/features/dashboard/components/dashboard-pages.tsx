import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"

import { UserDeleteAction, UserRoleActions, VendorQuickReview, VendorReviewActions } from "@/features/dashboard/components/admin-user-actions"
import { AdminDisputeActions } from "@/features/dashboard/components/admin-dispute-actions"
import { Card, CardContent } from "@/components/ui/card"
import { DetailGrid, DashboardTable, KpiGrid, PagePanel, ResourceCards, StatusBadge, TimelineList } from "@/features/dashboard/components/dashboard-ui"
import { DepositQuickActions } from "@/features/dashboard/components/deposit-quick-actions"
import { PaymentLinkManagementActions } from "@/features/dashboard/components/payment-link-management-actions"
import { TableQueryShell } from "@/features/dashboard/components/table-query-shell"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import type {
  AdminDisputeDetailRecord,
  AdminDisputeListData,
  AdminInviteListData,
  AdminLogListData,
  AdminSessionListData,
  AdminUserDetailRecord,
  AdminUserListData,
  AdminVendorListData,
  AdminWorkspaceRecord,
  TransactionDetailRecord,
  VendorClientListData,
  VendorDepositListData,
  VendorDisputeListData,
  VendorKycListData,
  VendorLinkListData,
  VendorPaymentListData,
  VendorSignatureListData,
  VendorTransactionsData,
  VendorWebhookListData,
  WorkspaceRecord,
} from "@/features/dashboard/server/dashboard-data"
import { getStatusTone } from "@/features/dashboard/server/dashboard-data"
import {
  adminInviteStatusOptions,
  adminLogSourceOptions,
  adminReviewStatusOptions,
  adminRoleOptions,
  adminSessionStateOptions,
  adminStripeConnectionOptions,
  vendorDisputeStatusOptions,
  vendorKycStatusOptions,
  vendorLinkStateOptions,
  vendorPaymentStatusOptions,
  vendorSignatureStatusOptions,
  vendorTransactionKindOptions,
  vendorTransactionStatusOptions,
  vendorWebhookStatusOptions,
} from "@/features/dashboard/filter-options"

type SearchParamsRecord = Record<string, string>

function TablePageSection({
  basePath,
  searchParams,
  searchValue,
  searchPlaceholder,
  filters,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  columns,
  rows,
  emptyMessage,
}: {
  basePath: string
  searchParams?: SearchParamsRecord
  searchValue?: string
  searchPlaceholder?: string
  filters?: {
    name: string
    label: string
    value?: string
    options: { label: string; value: string }[]
  }[]
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  columns: string[]
  rows: React.ReactNode[][]
  emptyMessage: string
}) {
  const shellKey = `${basePath}?${new URLSearchParams(searchParams).toString()}`

  return (
    <TableQueryShell
      key={shellKey}
      basePath={basePath}
      searchParams={searchParams}
      searchValue={searchValue}
      searchPlaceholder={searchPlaceholder}
      filters={filters}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
      pageSize={pageSize}
    >
      <DashboardTable columns={columns} rows={rows} emptyMessage={emptyMessage} />
    </TableQueryShell>
  )
}

export async function VendorActionsView({ workspace }: { workspace: WorkspaceRecord }) {
  const t = await getTranslations("dashboard.vendor.actions")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <DashboardTable
        columns={[t("columns.priority"), t("columns.action"), t("columns.client"), t("columns.reference"), t("columns.due")]}
        rows={workspace.actionItems.map((item) => [
          <StatusBadge key={`${item.reference}-priority`} tone={getStatusTone(item.priority)}>
            {item.priority}
          </StatusBadge>,
          item.action,
          item.client,
          item.reference,
          item.due,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorTransactionsView({
  data,
  searchParams,
}: {
  data: VendorTransactionsData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.transactions")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/transactions"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          { name: "status", label: t("columns.status"), value: searchParams?.status, options: vendorTransactionStatusOptions },
          { name: "kind", label: t("columns.type"), value: searchParams?.kind, options: vendorTransactionKindOptions },
        ]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.client"), t("columns.reference"), t("columns.type"), t("columns.amount"), t("columns.kyc"), t("columns.contract"), t("columns.status"), t("columns.date")]}
        rows={data.items.map((transaction) => [
          <div key={`${transaction.reference}-client`}>
            <p className="font-medium text-foreground">{transaction.clientName}</p>
            <p className="text-xs text-muted-foreground">{transaction.clientEmail}</p>
          </div>,
          <Link key={`${transaction.reference}-detail`} href={`/vendor/transactions/${transaction.id}`} className="font-medium text-foreground hover:text-(--contrazy-teal)">
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
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorTransactionDetailView({ detail }: { detail: TransactionDetailRecord }) {
  const t = await getTranslations("dashboard")
  return (
    <div className="space-y-6">
      <PagePanel title={`${detail.title} ${detail.reference}`} description={detail.summaryLine}>
        <DetailGrid items={detail.facts.map((fact) => ({ label: fact.label, value: fact.value }))} />
      </PagePanel>

      <PagePanel title={t("shared.timelineTitle")} description={t("shared.timelineDescription")}>
        <TimelineList items={detail.timeline} />
      </PagePanel>
    </div>
  )
}

export async function VendorContractsView({ workspace }: { workspace: WorkspaceRecord }) {
  const t = await getTranslations("dashboard.vendor.contracts")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <ResourceCards
        items={workspace.contractTemplates}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />
    </PagePanel>
  )
}

export async function VendorChecklistsView({ workspace }: { workspace: WorkspaceRecord }) {
  const t = await getTranslations("dashboard.vendor.checklists")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <ResourceCards
        items={workspace.checklistTemplates}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />
    </PagePanel>
  )
}

export async function VendorKycView({
  data,
  searchParams,
}: {
  data: VendorKycListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.kyc")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/kyc"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[{ name: "status", label: t("columns.status"), value: searchParams?.status, options: vendorKycStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.client"), t("columns.reference"), t("columns.status"), t("columns.provider"), t("columns.note")]}
        rows={data.items.map((record) => [
          record.client,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.provider,
          record.note,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorSignaturesView({
  data,
  searchParams,
}: {
  data: VendorSignatureListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.signatures")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/signatures"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[{ name: "status", label: t("columns.status"), value: searchParams?.status, options: vendorSignatureStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.signer"), t("columns.reference"), t("columns.status"), t("columns.template"), t("columns.date")]}
        rows={data.items.map((record) => [
          record.signer,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.template,
          record.date,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorDepositsView({
  data,
  searchParams,
}: {
  data: VendorDepositListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.deposits")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/deposits"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[{ name: "status", label: t("columns.status"), value: searchParams?.status, options: vendorPaymentStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.client"), t("columns.reference"), t("columns.amount"), t("columns.status"), t("columns.window"), t("columns.actions")]}
        rows={data.items.map((record) => [
          record.client,
          record.reference,
          record.amount,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.date,
          <DepositQuickActions
            key={`${record.reference}-actions`}
            transactionId={record.transactionId}
            status={record.status}
            amountCents={record.amountCents}
            currency={record.currency}
          />,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorPaymentsView({
  data,
  searchParams,
}: {
  data: VendorPaymentListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.payments")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/payments"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[{ name: "status", label: t("columns.status"), value: searchParams?.status, options: vendorPaymentStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.client"), t("columns.reference"), t("columns.amount"), t("columns.status"), t("columns.date")]}
        rows={data.items.map((record) => [
          record.client,
          record.reference,
          record.amount,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.date,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorDisputesView({
  data,
  searchParams,
}: {
  data: VendorDisputeListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.disputes")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/disputes"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[{ name: "status", label: t("columns.status"), value: searchParams?.status, options: vendorDisputeStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.client"), t("columns.reference"), t("columns.status"), t("columns.summary")]}
        rows={data.items.map((record) => [
          record.client,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.summary,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorClientsView({
  data,
  searchParams,
}: {
  data: VendorClientListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.clients")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/clients"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.client"), t("columns.email"), t("columns.status"), t("columns.recentTransaction")]}
        rows={data.items.map((record) => [
          record.name,
          record.email,
          <StatusBadge key={`${record.email}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.lastTransaction,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorLinksView({
  data,
  searchParams,
}: {
  data: VendorLinkListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.links")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/links"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          { name: "state", label: t("columns.status"), value: searchParams?.state, options: vendorLinkStateOptions },
          { name: "kind", label: t("columns.type"), value: searchParams?.kind, options: vendorTransactionKindOptions },
        ]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.reference"), t("columns.client"), t("columns.title"), t("columns.amounts"), t("columns.shortCode"), t("columns.lastActivity"), t("columns.status"), t("columns.actions")]}
        rows={data.items.map((record) => [
          <Link
            key={`${record.reference}-reference`}
            href={`/vendor/transactions/${record.transactionId}`}
            className="inline-block min-w-[130px] font-medium text-foreground hover:text-(--contrazy-teal)"
          >
            {record.reference}
          </Link>,
          <div key={`${record.reference}-client`} className="w-[180px] min-w-[180px]">
            <p className="truncate font-medium text-foreground" title={record.clientName}>
              {record.clientName}
            </p>
            <p className="truncate text-xs text-muted-foreground" title={record.clientEmail}>
              {record.clientEmail}
            </p>
          </div>,
          <div key={`${record.reference}-title`} className="w-[240px] min-w-[240px]">
            <p
              className="truncate text-sm font-medium text-foreground"
              title={record.title}
            >
              {record.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {record.kind.replaceAll("_", " ")}
            </p>
          </div>,
          <div key={`${record.reference}-amounts`} className="min-w-[132px] space-y-1">
            {record.kind !== "DEPOSIT" && (
              <p className="text-sm font-medium text-foreground">{t("serviceAmount", { amount: record.serviceAmount })}</p>
            )}
            {record.kind !== "PAYMENT" && (
              <p className="text-xs text-muted-foreground">{t("depositAmount", { amount: record.depositAmount })}</p>
            )}
          </div>,
          <span key={`${record.reference}-short-code`} className="inline-block min-w-[88px]">
            {record.shortCode}
          </span>,
          <span key={`${record.reference}-last-activity`} className="inline-block min-w-[112px]">
            {record.lastActivity}
          </span>,
          <StatusBadge key={`${record.reference}-state`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          <PaymentLinkManagementActions
            key={`${record.id}-${record.status}-${record.title}-${record.expiresAt ?? "none"}`}
            record={record}
          />,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorWebhooksView({
  data,
  searchParams,
}: {
  data: VendorWebhookListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.vendor.webhooks")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/vendor/webhooks"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[{ name: "status", label: t("columns.status"), value: searchParams?.status, options: vendorWebhookStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.provider"), t("columns.event"), t("columns.reference"), t("columns.status"), t("columns.date")]}
        rows={data.items.map((record) => [
          record.provider,
          <div key={`${record.eventType}-${record.date}-event`}>
            <p className="font-medium text-foreground">{record.eventType}</p>
            {record.detail ? <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{record.detail}</p> : null}
            {record.error ? <p className="mt-1 max-w-xs truncate text-xs text-destructive">{record.error}</p> : null}
          </div>,
          record.reference,
          <StatusBadge key={`${record.eventType}-${record.date}`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.date,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function VendorStripeView({ workspace }: { workspace: WorkspaceRecord }) {
  const t = await getTranslations("dashboard.vendor.stripe")
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <PagePanel title={t("payoutSetup.title")} description={t("payoutSetup.description")}>
        <DetailGrid
          items={[
            { label: t("details.business"), value: workspace.summary.businessName },
            {
              label: t("details.reviewStatus"),
              value: <StatusBadge tone={getStatusTone(workspace.summary.reviewStatus)}>{workspace.summary.reviewStatus}</StatusBadge>,
            },
            {
              label: t("details.payoutStatus"),
              value: (
                <StatusBadge tone={getStatusTone(workspace.summary.stripeConnectionStatus)}>
                  {workspace.summary.stripeConnectionStatus}
                </StatusBadge>
              ),
            },
            { label: t("details.primaryEmail"), value: workspace.summary.businessEmail },
            { label: t("details.recentPaymentState"), value: workspace.payments[0]?.status ?? t("details.noData") },
            { label: t("details.recentDepositState"), value: workspace.deposits[0]?.status ?? t("details.noData") },
          ]}
        />
      </PagePanel>
      <PagePanel title={t("nextSteps.title")} description={t("nextSteps.description")}>
        <ResourceCards
          items={[
            {
              title: t("nextSteps.finishPayout.title"),
              description: t("nextSteps.finishPayout.description"),
            },
            {
              title: t("nextSteps.keepDetails.title"),
              description: t("nextSteps.keepDetails.description"),
            },
            {
              title: t("nextSteps.monitorCollections.title"),
              description: t("nextSteps.monitorCollections.description"),
            },
          ]}
        />
      </PagePanel>
    </div>
  )
}

export async function AdminVendorListView({
  data,
  searchParams,
}: {
  data: AdminVendorListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.admin.vendors")
  return (
    <div className="space-y-6">
      <KpiGrid items={data.kpis} />

      <PagePanel
        title={t("title")}
        description={t("description")}
        actionHref="/admin/users"
        actionLabel={t("allUsers")}
      >
        <TablePageSection
          basePath="/admin/vendors"
          searchValue={searchParams?.q}
          searchPlaceholder={t("searchPlaceholder")}
        filters={[
            { name: "reviewStatus", label: t("columns.reviewStatus"), value: searchParams?.reviewStatus, options: adminReviewStatusOptions },
            { name: "stripeStatus", label: t("filters.payouts"), value: searchParams?.stripeStatus, options: adminStripeConnectionOptions },
          ]}
          currentPage={data.page}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
          pageSize={data.pageSize}
          searchParams={searchParams}
          columns={[t("columns.business"), t("columns.owner"), t("columns.country"), t("columns.profile"), t("columns.transactions"), t("columns.reviewStatus"), t("columns.joined"), t("columns.actions")]}
          rows={data.vendors.map((vendor) => [
            <div key={`${vendor.id}-business`}>
              <Link href={`/admin/users/${vendor.userId}`} className="font-medium text-foreground hover:text-(--contrazy-teal)">
                {vendor.businessName}
              </Link>
              <p className="text-xs text-muted-foreground">{vendor.businessEmail}</p>
            </div>,
            <div key={`${vendor.id}-owner`}>
              <p className="text-sm">{vendor.userName}</p>
              <p className="text-xs text-muted-foreground">{vendor.userEmail}</p>
            </div>,
            vendor.businessCountry,
            <span key={`${vendor.id}-profile`} className={`text-sm font-medium ${vendor.profileCompletion === 100 ? "text-emerald-600" : "text-amber-600"}`}>
              {vendor.profileCompletion}%
            </span>,
            <span key={`${vendor.id}-txn`} className="text-sm text-muted-foreground">
              {t("txSummary", { txCount: vendor.transactionCount, clientCount: vendor.clientCount })}
            </span>,
            <StatusBadge key={`${vendor.id}-status`} tone={getStatusTone(vendor.reviewStatus)}>
              {vendor.reviewStatus}
            </StatusBadge>,
            vendor.joinedAt,
            <VendorQuickReview key={`${vendor.id}-actions`} userId={vendor.userId} currentStatus={vendor.reviewStatus} />,
          ])}
          emptyMessage={t("empty")}
        />
      </PagePanel>
    </div>
  )
}

export async function AdminUsersView({
  data,
  searchParams,
}: {
  data: AdminUserListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.admin.users")
  const { users, totalCount, page, pageSize, totalPages } = data
  const descriptionText = t("description", {
    count: totalCount,
    plural: totalCount === 1 ? "" : "s",
  })

  return (
    <PagePanel
      title={t("title")}
      description={descriptionText}
    >
      <TablePageSection
        basePath="/admin/users"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          { name: "role", label: t("columns.role"), value: searchParams?.role, options: adminRoleOptions },
          { name: "reviewStatus", label: t("columns.reviewStatus"), value: searchParams?.reviewStatus, options: adminReviewStatusOptions },
        ]}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        searchParams={searchParams}
        columns={[t("columns.nameEmail"), t("columns.role"), t("columns.business"), t("columns.reviewStatus"), t("columns.joined"), t("columns.quickActions")]}
        rows={users.map((user) => [
          <div key={`${user.id}-name`}>
            <Link
              href={`/admin/users/${user.id}`}
              className="font-medium text-foreground hover:text-(--contrazy-teal)"
            >
              {user.name}
            </Link>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>,

          <StatusBadge key={`${user.id}-role`} tone={getStatusTone(user.role)}>
            {user.role}
          </StatusBadge>,

          <span key={`${user.id}-company`} className="text-sm">{user.company}</span>,

          user.reviewStatus ? (
            <StatusBadge key={`${user.id}-review`} tone={getStatusTone(user.reviewStatus)}>
              {user.reviewStatus}
            </StatusBadge>
          ) : (
            <span key={`${user.id}-no-review`} className="text-xs text-muted-foreground">—</span>
          ),

          <span key={`${user.id}-joined`} className="whitespace-nowrap text-sm text-muted-foreground">
            {user.joinedAt}
          </span>,

          user.reviewStatus ? (
            <VendorQuickReview
              key={`${user.id}-actions`}
              userId={user.id}
              currentStatus={user.reviewStatus}
            />
          ) : (
            <Link
              key={`${user.id}-view`}
              href={`/admin/users/${user.id}`}
              className="text-xs text-(--contrazy-teal) hover:underline"
            >
              {t("view")}
            </Link>
          ),
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

function userInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export async function AdminUserDetailView({ user }: { user: AdminUserDetailRecord }) {
  const t = await getTranslations("dashboard.admin.userDetail")
  const vp = user.vendorProfile

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-(--contrazy-teal)/10 text-lg font-bold text-(--contrazy-teal) ring-2 ring-(--contrazy-teal)/20">
              {userInitials(user.name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{user.name}</h1>
                <StatusBadge tone={getStatusTone(user.role)}>{user.role}</StatusBadge>
                {vp ? (
                  <StatusBadge tone={getStatusTone(vp.reviewStatus)}>{vp.reviewStatus}</StatusBadge>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>{t("joinedLabel", { date: user.joinedAt })}</span>
                {user.emailVerified ? (
                  <span className="text-emerald-600">{t("emailVerifiedLabel", { date: user.emailVerified })}</span>
                ) : (
                  <span className="text-amber-600">{t("emailNotVerified")}</span>
                )}
                <span className="hidden sm:inline font-mono opacity-60">ID: {user.id}</span>
              </div>
            </div>

            {vp ? (
              <div className="flex shrink-0 gap-5 rounded-xl border border-border bg-muted/40 px-5 py-3 sm:flex-col sm:gap-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{vp.transactionCount}</p>
                  <p className="text-[11px] text-muted-foreground">{t("kpiTransactions")}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{vp.clientCount}</p>
                  <p className="text-[11px] text-muted-foreground">{t("kpiClients")}</p>
                </div>
                <div className="text-center">
                  <p className={`text-xl font-bold ${vp.profileCompletion === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                    {vp.profileCompletion}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t("kpiProfile")}</p>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <PagePanel title={t("accountDetails.title")} description={t("accountDetails.description")}>
          <DetailGrid
            items={[
              { label: t("accountDetails.fullName"), value: user.name },
              { label: t("accountDetails.email"), value: user.email },
              { label: t("accountDetails.company"), value: user.company || "—" },
              {
                label: t("accountDetails.accountStatus"),
                value: <StatusBadge tone={getStatusTone(user.status)}>{user.status}</StatusBadge>,
              },
              { label: t("accountDetails.emailVerified"), value: user.emailVerified ?? t("accountDetails.notVerified") },
              { label: t("accountDetails.joined"), value: user.joinedAt },
            ]}
          />
        </PagePanel>

        <PagePanel title={t("roleManagement.title")} description={t("roleManagement.description")}>
          <UserRoleActions userId={user.id} currentRole={user.role} />
        </PagePanel>
      </div>

      {vp ? (
        <PagePanel title={t("businessProfile.title")} description={t("businessProfile.description")}>
          <div className="space-y-6">
            <DetailGrid
              items={[
                { label: t("businessProfile.businessName"), value: vp.businessName || "—" },
                { label: t("businessProfile.businessEmail"), value: vp.businessEmail || "—" },
                { label: t("businessProfile.supportEmail"), value: vp.supportEmail || "—" },
                { label: t("businessProfile.phone"), value: vp.businessPhone || "—" },
                { label: t("businessProfile.address"), value: vp.businessAddress || "—" },
                { label: t("businessProfile.country"), value: vp.businessCountry || "—" },
                {
                  label: t("businessProfile.payout"),
                  value: (
                    <StatusBadge tone={getStatusTone(vp.stripeConnectionStatus)}>
                      {vp.stripeConnectionStatus}
                    </StatusBadge>
                  ),
                },
                { label: t("businessProfile.profileComplete"), value: `${vp.profileCompletion}%` },
              ]}
            />

            <div className="border-t border-border pt-5">
              <p className="mb-3 text-sm font-semibold text-foreground">{t("businessProfile.reviewStatus")}</p>
              <VendorReviewActions userId={user.id} currentStatus={vp.reviewStatus} />
            </div>
          </div>
        </PagePanel>
      ) : null}

      <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 dark:border-red-900 dark:bg-red-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">{t("dangerZone.title")}</h3>
            <p className="mt-1 max-w-prose text-sm text-red-700 dark:text-red-500">
              {t("dangerZone.description")}
            </p>
          </div>
          <div className="shrink-0">
            <UserDeleteAction userId={user.id} userEmail={user.email} />
          </div>
        </div>
      </div>
    </div>
  )
}

export async function AdminInvitesView({
  data,
  searchParams,
}: {
  data: AdminInviteListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.admin.invites")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/admin/invites"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          { name: "role", label: t("columns.role"), value: searchParams?.role, options: adminRoleOptions },
          { name: "status", label: t("columns.status"), value: searchParams?.status, options: adminInviteStatusOptions },
        ]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.email"), t("columns.role"), t("columns.status"), t("columns.expires")]}
        rows={data.items.map((invite) => [
          invite.email,
          <StatusBadge key={`${invite.id}-role`} tone={getStatusTone(invite.role)}>
            {invite.role}
          </StatusBadge>,
          <StatusBadge key={`${invite.id}-status`} tone={getStatusTone(invite.status)}>
            {invite.status}
          </StatusBadge>,
          invite.expiresAt,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function AdminRolesView({ workspace }: { workspace: AdminWorkspaceRecord }) {
  const t = await getTranslations("dashboard.admin.roles")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <ResourceCards
        items={workspace.rolePolicies}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
      />
    </PagePanel>
  )
}

export async function AdminLogsView({
  data,
  searchParams,
}: {
  data: AdminLogListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.admin.logs")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/admin/logs"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[{ name: "source", label: t("filters.source"), value: searchParams?.source, options: adminLogSourceOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.actor"), t("columns.action"), t("columns.entity"), t("columns.date")]}
        rows={data.items.map((log) => [log.actor, log.action, log.entity, log.date])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function AdminSessionsView({
  data,
  searchParams,
}: {
  data: AdminSessionListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.admin.sessions")
  return (
    <PagePanel title={t("title")} description={t("description")}>
      <TablePageSection
        basePath="/admin/sessions"
        searchValue={searchParams?.q}
        searchPlaceholder={t("searchPlaceholder")}
        filters={[
          { name: "role", label: t("columns.role"), value: searchParams?.role, options: adminRoleOptions },
          { name: "state", label: t("columns.state"), value: searchParams?.state, options: adminSessionStateOptions },
        ]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={[t("columns.user"), t("columns.role"), t("columns.state"), t("columns.lastSeen")]}
        rows={data.items.map((session) => [
          session.user,
          <StatusBadge key={`${session.user}-role`} tone={getStatusTone(session.role)}>
            {session.role}
          </StatusBadge>,
          <StatusBadge key={`${session.user}-state`} tone={getStatusTone(session.state)}>
            {session.state}
          </StatusBadge>,
          session.lastSeen,
        ])}
        emptyMessage={t("empty")}
      />
    </PagePanel>
  )
}

export async function AdminDisputeListView({
  data,
  searchParams,
}: {
  data: AdminDisputeListData
  searchParams?: Record<string, string>
}) {
  const t = await getTranslations("dashboard.admin.disputes")
  return (
    <div className="space-y-6">
      <KpiGrid items={data.kpis} />

      <PagePanel
        title={t("listTitle")}
        description={t("listDescription")}
      >
        <TablePageSection
          basePath="/admin/disputes"
          searchValue={searchParams?.q}
          searchPlaceholder={t("searchPlaceholder")}
          filters={[{ name: "status", label: t("columns.status"), value: searchParams?.status, options: vendorDisputeStatusOptions }]}
          currentPage={data.page}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
          pageSize={data.pageSize}
          searchParams={searchParams}
          columns={[t("columns.case"), t("columns.vendor"), t("columns.client"), t("columns.deposit"), t("columns.deadline"), t("columns.status"), t("columns.opened")]}
          rows={data.disputes.map((d) => [
            <Link
              key={`${d.id}-ref`}
              href={`/admin/disputes/${d.id}`}
              className="font-medium text-foreground hover:text-(--contrazy-teal)"
            >
              ⚖️ {d.reference}
            </Link>,
            <div key={`${d.id}-vendor`}>
              <p className="text-sm font-medium">{d.vendorName}</p>
              <p className="text-xs text-muted-foreground">{d.vendorEmail}</p>
            </div>,
            <div key={`${d.id}-client`}>
              <p className="text-sm">{d.clientName}</p>
              <p className="text-xs text-muted-foreground">{d.clientEmail}</p>
            </div>,
            <span key={`${d.id}-amount`} className="font-medium tabular-nums">{d.depositAmount}</span>,
            <span
              key={`${d.id}-deadline`}
              className={`text-sm ${d.resolvedAt ? "text-muted-foreground" : "font-medium text-amber-600"}`}
            >
              {d.resolvedAt ? "—" : d.deadlineAt}
            </span>,
            <StatusBadge key={`${d.id}-status`} tone={getStatusTone(d.status)}>{d.status}</StatusBadge>,
            d.openedAt,
          ])}
          emptyMessage={t("empty")}
        />
      </PagePanel>
    </div>
  )
}

export async function AdminDisputeDetailView({ dispute }: { dispute: AdminDisputeDetailRecord }) {
  const t = await getTranslations("dashboard.admin.disputes")
  const sharedT = await getTranslations("dashboard.shared")
  const statusTone = getStatusTone(dispute.status)
  const isPending = dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW"

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/admin/disputes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        {t("backToDisputes")}
      </Link>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="border-b border-border px-6 py-5">
            <h2 className="text-lg font-bold tracking-tight">
              ⚖️ {t("caseTitle")} · {dispute.clientName} · {dispute.reference}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{dispute.summary}</p>
          </div>

          <div className="grid grid-cols-1 border-b border-border sm:grid-cols-3">
            {[
              { label: t("detailVendor"), value: dispute.vendorName },
              { label: t("detailDeposit"), value: dispute.depositAmount },
              {
                label: t("detailStatus"),
                value: (
                  <StatusBadge tone={statusTone}>{dispute.status.replace("_", " ")}</StatusBadge>
                ),
              },
            ].map((cell, i) => (
              <div
                key={cell.label}
                className={`px-6 py-4 ${i < 2 ? "border-b border-border sm:border-b-0 sm:border-r" : ""}`}
              >
                <p className="mb-1 text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">{cell.label}</p>
                <div className="text-sm font-medium text-foreground">{cell.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 border-b border-border sm:grid-cols-3">
            {[
              { label: t("openedOn"), value: dispute.openedAt },
              {
                label: t("responseDeadline"),
                value: (
                  <span className={isPending ? "font-semibold text-amber-600" : "text-foreground"}>
                    {dispute.deadlineAt}
                  </span>
                ),
              },
              {
                label: t("attachments"),
                value: sharedT("fileCount", { count: dispute.attachmentCount }),
              },
            ].map((cell, i) => (
              <div
                key={cell.label}
                className={`px-6 py-4 ${i < 2 ? "border-b border-border sm:border-b-0 sm:border-r" : ""}`}
              >
                <p className="mb-1 text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">{cell.label}</p>
                <div className="text-sm font-medium text-foreground">{cell.value}</div>
              </div>
            ))}
          </div>

          {dispute.resolution && (
            <div className="border-b border-border px-6 py-4 bg-muted/30">
              <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase mb-1">{sharedT("adminResolutionNote")}</p>
              <p className="text-sm text-foreground">{dispute.resolution}</p>
              {dispute.resolvedAt && (
                <p className="mt-1 text-xs text-muted-foreground">{sharedT("resolvedOn", { date: dispute.resolvedAt })}</p>
              )}
            </div>
          )}

          <div className="border-b border-border px-6 py-5">
            <p className="mb-3 text-sm font-semibold">📎 {sharedT("supportingDocuments")}</p>
            {dispute.documents.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dispute.documents.map((doc) => (
                  doc.assetUrl ? (
                    <a
                      key={doc.id}
                      href={resolveDocumentAssetUrl(doc.assetUrl, doc.fileName) ?? doc.assetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[13px] text-foreground transition-colors hover:border-(--contrazy-teal)/40 hover:bg-(--contrazy-teal)/5"
                    >
                      <span className="text-[15px]">{doc.type === "PHOTO" ? "🖼" : "📄"}</span>
                      {doc.fileName ?? doc.label}
                    </a>
                  ) : (
                    <div
                      key={doc.id}
                      className="rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[13px] text-foreground"
                    >
                      <p className="font-medium">{doc.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{doc.textValue ?? sharedT("textResponseSubmitted")}</p>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{sharedT("noDocuments")}</p>
            )}
          </div>

          <div className="border-b border-border px-6 py-5">
            <p className="mb-4 text-sm font-semibold">🕓 {sharedT("history")}</p>
            <ol className="space-y-4">
              {dispute.history.map((ev, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-0.5 size-2.5 shrink-0 rounded-full ${ev.pending ? "bg-muted-foreground/40" : "bg-(--contrazy-teal)"}`}
                    />
                    {i < dispute.history.length - 1 && (
                      <div className="mt-1 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="pb-2">
                    <p className={`text-sm font-medium ${ev.pending ? "text-amber-600" : "text-foreground"}`}>{ev.title}</p>
                    {ev.occurredAt && (
                      <p className="text-xs text-muted-foreground">{ev.occurredAt}</p>
                    )}
                    {ev.detail && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{ev.detail}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="px-6 py-5">
            <AdminDisputeActions disputeId={dispute.id} status={dispute.status} />
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        {sharedT("transactionLabel")}:{" "}
        <Link
          href={`/vendor/transactions/${dispute.transactionId}`}
          className="font-medium text-(--contrazy-teal) hover:underline"
        >
          {dispute.reference} — {dispute.title}
        </Link>
        {" · "}{dispute.vendorName}
      </div>
    </div>
  )
}
