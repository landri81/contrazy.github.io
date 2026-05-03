import Link from "next/link"

import { UserDeleteAction, UserRoleActions, VendorQuickReview, VendorReviewActions } from "@/features/dashboard/components/admin-user-actions"
import { Card, CardContent } from "@/components/ui/card"
import { DetailGrid, DashboardTable, KpiGrid, PagePanel, ResourceCards, StatusBadge, TimelineList } from "@/features/dashboard/components/dashboard-ui"
import { DepositQuickActions } from "@/features/dashboard/components/deposit-quick-actions"
import { PaymentLinkManagementActions } from "@/features/dashboard/components/payment-link-management-actions"
import { TableQueryShell } from "@/features/dashboard/components/table-query-shell"
import type {
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

export function VendorActionsView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Action queue" description="Priority tasks to keep the account and customer flow moving.">
      <DashboardTable
        columns={["Priority", "Action", "Client", "Reference", "Due"]}
        rows={workspace.actionItems.map((item) => [
          <StatusBadge key={`${item.reference}-priority`} tone={getStatusTone(item.priority)}>
            {item.priority}
          </StatusBadge>,
          item.action,
          item.client,
          item.reference,
          item.due,
        ])}
        emptyMessage="Nothing needs attention right now."
      />
    </PagePanel>
  )
}

export function VendorTransactionsView({
  data,
  searchParams,
}: {
  data: VendorTransactionsData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Transactions" description="Track every customer workflow from setup to payment and deposit handling.">
      <TablePageSection
        basePath="/vendor/transactions"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by reference, title, client name, or email"
        filters={[
          { name: "status", label: "Status", value: searchParams?.status, options: vendorTransactionStatusOptions },
          { name: "kind", label: "Type", value: searchParams?.kind, options: vendorTransactionKindOptions },
        ]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Client", "Reference", "Type", "Amount", "KYC", "Contract", "Status", "Date"]}
        rows={data.items.map((transaction) => [
          <div key={`${transaction.reference}-client`}>
            <p className="font-medium text-foreground">{transaction.clientName}</p>
            <p className="text-xs text-muted-foreground">{transaction.clientEmail}</p>
          </div>,
          <Link key={`${transaction.reference}-detail`} href={`/vendor/transactions/${transaction.id}`} className="font-medium text-foreground hover:text-[var(--contrazy-teal)]">
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
  )
}

export function VendorTransactionDetailView({ detail }: { detail: TransactionDetailRecord }) {
  return (
    <div className="space-y-6">
      <PagePanel title={`${detail.title} ${detail.reference}`} description={detail.summaryLine}>
        <DetailGrid items={detail.facts.map((fact) => ({ label: fact.label, value: fact.value }))} />
      </PagePanel>

      <PagePanel title="Timeline" description="Key moments across the customer journey.">
        <TimelineList items={detail.timeline} />
      </PagePanel>
    </div>
  )
}

export function VendorContractsView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Contract templates" description="Save the agreements you want to reuse across future workflows.">
      <ResourceCards
        items={workspace.contractTemplates}
        emptyTitle="No contract templates yet"
        emptyDescription="Add your first agreement template before sending customer links."
      />
    </PagePanel>
  )
}

export function VendorChecklistsView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Checklist templates" description="Store the documents and photos you want to request for each workflow.">
      <ResourceCards
        items={workspace.checklistTemplates}
        emptyTitle="No checklists yet"
        emptyDescription="Create a checklist when you are ready to request customer documents."
      />
    </PagePanel>
  )
}

export function VendorKycView({
  data,
  searchParams,
}: {
  data: VendorKycListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Identity checks" description="Follow customer verification progress when identity confirmation is required.">
      <TablePageSection
        basePath="/vendor/kyc"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by client, reference, provider, or note"
        filters={[{ name: "status", label: "Status", value: searchParams?.status, options: vendorKycStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Client", "Reference", "Status", "Provider", "Note"]}
        rows={data.items.map((record) => [
          record.client,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.provider,
          record.note,
        ])}
        emptyMessage="No identity checks are waiting right now."
      />
    </PagePanel>
  )
}

export function VendorSignaturesView({
  data,
  searchParams,
}: {
  data: VendorSignatureListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Signatures" description="See which customers have reviewed and accepted their agreements.">
      <TablePageSection
        basePath="/vendor/signatures"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by signer, reference, or template"
        filters={[{ name: "status", label: "Status", value: searchParams?.status, options: vendorSignatureStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Signer", "Reference", "Status", "Template", "Date"]}
        rows={data.items.map((record) => [
          record.signer,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.template,
          record.date,
        ])}
        emptyMessage="No signatures have been requested yet."
      />
    </PagePanel>
  )
}

export function VendorDepositsView({
  data,
  searchParams,
}: {
  data: VendorDepositListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Deposits" description="Monitor active holds, expiry windows, and later release or capture decisions.">
      <TablePageSection
        basePath="/vendor/deposits"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by client name, email, or reference"
        filters={[{ name: "status", label: "Status", value: searchParams?.status, options: vendorPaymentStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Client", "Reference", "Amount", "Status", "Window", "Actions"]}
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
        emptyMessage="No deposit activity yet."
      />
    </PagePanel>
  )
}

export function VendorPaymentsView({
  data,
  searchParams,
}: {
  data: VendorPaymentListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Payments" description="Review payment collection across your customer workflows.">
      <TablePageSection
        basePath="/vendor/payments"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by client name, email, or reference"
        filters={[{ name: "status", label: "Status", value: searchParams?.status, options: vendorPaymentStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Client", "Reference", "Amount", "Status", "Date"]}
        rows={data.items.map((record) => [
          record.client,
          record.reference,
          record.amount,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.date,
        ])}
        emptyMessage="No payments have been recorded yet."
      />
    </PagePanel>
  )
}

export function VendorDisputesView({
  data,
  searchParams,
}: {
  data: VendorDisputeListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Disputes" description="Track customer issues related to payments or deposits.">
      <TablePageSection
        basePath="/vendor/disputes"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by client, reference, or summary"
        filters={[{ name: "status", label: "Status", value: searchParams?.status, options: vendorDisputeStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Client", "Reference", "Status", "Summary"]}
        rows={data.items.map((record) => [
          record.client,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.summary,
        ])}
        emptyMessage="No disputes have been opened."
      />
    </PagePanel>
  )
}

export function VendorClientsView({
  data,
  searchParams,
}: {
  data: VendorClientListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Clients" description="Review recent customers and the workflows connected to them.">
      <TablePageSection
        basePath="/vendor/clients"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by client name, email, or company"
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Client", "Email", "Status", "Recent transaction"]}
        rows={data.items.map((record) => [
          record.name,
          record.email,
          <StatusBadge key={`${record.email}-status`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.lastTransaction,
        ])}
        emptyMessage="No customer profiles have been captured yet."
      />
    </PagePanel>
  )
}

export function VendorLinksView({
  data,
  searchParams,
}: {
  data: VendorLinkListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Customer links" description="Share secure links and QR codes for each customer workflow.">
      <TablePageSection
        basePath="/vendor/links"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by reference, title, client, or short code"
        filters={[
          { name: "state", label: "State", value: searchParams?.state, options: vendorLinkStateOptions },
          { name: "kind", label: "Type", value: searchParams?.kind, options: vendorTransactionKindOptions },
        ]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Reference", "Client", "Title", "Amounts", "Short code", "Last activity", "Status", "Actions"]}
        rows={data.items.map((record) => [
          <Link key={`${record.reference}-reference`} href={`/vendor/transactions/${record.transactionId}`} className="font-medium text-foreground hover:text-[var(--contrazy-teal)]">
            {record.reference}
          </Link>,
          <div key={`${record.reference}-client`}>
            <p className="font-medium text-foreground">{record.clientName}</p>
            <p className="text-xs text-muted-foreground">{record.clientEmail}</p>
          </div>,
          <div key={`${record.reference}-title`}>
            <p className="font-medium text-foreground">{record.title}</p>
            <p className="text-xs text-muted-foreground">{record.kind.replaceAll("_", " ")}</p>
          </div>,
          <div key={`${record.reference}-amounts`} className="space-y-1">
            {record.kind !== "DEPOSIT" && (
              <p className="text-sm font-medium text-foreground">Service: {record.serviceAmount}</p>
            )}
            {record.kind !== "PAYMENT" && (
              <p className="text-xs text-muted-foreground">Deposit: {record.depositAmount}</p>
            )}
          </div>,
          record.shortCode,
          record.lastActivity,
          <StatusBadge key={`${record.reference}-state`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          <PaymentLinkManagementActions
            key={`${record.id}-${record.status}-${record.title}-${record.expiresAt ?? "none"}`}
            record={record}
          />,
        ])}
        emptyMessage="No customer links have been issued yet."
      />
    </PagePanel>
  )
}

export function VendorWebhooksView({
  data,
  searchParams,
}: {
  data: VendorWebhookListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Event history" description="Review delivery events and payment updates connected to your account.">
      <TablePageSection
        basePath="/vendor/webhooks"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by provider, event name, Stripe ID, or reference"
        filters={[{ name: "status", label: "Status", value: searchParams?.status, options: vendorWebhookStatusOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Provider", "Event", "Reference", "Status", "Date"]}
        rows={data.items.map((record) => [
          record.provider,
          <div key={`${record.eventType}-${record.date}-event`}>
            <p className="font-medium text-foreground">{record.eventType}</p>
            {record.error ? <p className="mt-1 max-w-xs truncate text-xs text-destructive">{record.error}</p> : null}
          </div>,
          record.reference,
          <StatusBadge key={`${record.eventType}-${record.date}`} tone={getStatusTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.date,
        ])}
        emptyMessage="No event history is available yet."
      />
    </PagePanel>
  )
}

export function VendorStripeView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <PagePanel title="Payout setup" description="Review the business details tied to customer payments and deposits.">
        <DetailGrid
          items={[
            { label: "Business", value: workspace.summary.businessName },
            {
              label: "Review status",
              value: <StatusBadge tone={getStatusTone(workspace.summary.reviewStatus)}>{workspace.summary.reviewStatus}</StatusBadge>,
            },
            {
              label: "Payout status",
              value: (
                <StatusBadge tone={getStatusTone(workspace.summary.stripeConnectionStatus)}>
                  {workspace.summary.stripeConnectionStatus}
                </StatusBadge>
              ),
            },
            { label: "Primary email", value: workspace.summary.businessEmail },
            { label: "Recent payment state", value: workspace.payments[0]?.status ?? "No data" },
            { label: "Recent deposit state", value: workspace.deposits[0]?.status ?? "No data" },
          ]}
        />
      </PagePanel>
      <PagePanel title="Recommended next steps" description="Use these checks before accepting live customer payments.">
        <ResourceCards
          items={[
            {
              title: "Finish payout details",
              description: "Confirm the payout account so customer funds and deposit holds can move without delay.",
            },
            {
              title: "Keep business details current",
              description: "Make sure the business email, support email, phone number, and address stay up to date.",
            },
            {
              title: "Monitor customer collections",
              description: "Check payment and deposit activity here before moving into higher transaction volume.",
            },
          ]}
        />
      </PagePanel>
    </div>
  )
}

export function AdminVendorListView({
  data,
  searchParams,
}: {
  data: AdminVendorListData
  searchParams?: Record<string, string>
}) {
  return (
    <div className="space-y-6">
      <KpiGrid items={data.kpis} />

      <PagePanel
        title="Vendor accounts"
        description="Manage approval status for all vendor accounts. Use the inline actions to approve, pend, reject, or suspend."
        actionHref="/admin/users"
        actionLabel="All users"
      >
        <TablePageSection
          basePath="/admin/vendors"
          searchValue={searchParams?.q}
          searchPlaceholder="Search by business, owner, email, phone, or country"
          filters={[
            { name: "reviewStatus", label: "Review", value: searchParams?.reviewStatus, options: adminReviewStatusOptions },
            { name: "stripeStatus", label: "Payouts", value: searchParams?.stripeStatus, options: adminStripeConnectionOptions },
          ]}
          currentPage={data.page}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
          pageSize={data.pageSize}
          searchParams={searchParams}
          columns={["Business", "Owner", "Country", "Profile", "Transactions", "Review status", "Joined", "Actions"]}
          rows={data.vendors.map((vendor) => [
            <div key={`${vendor.id}-business`}>
              <Link href={`/admin/users/${vendor.userId}`} className="font-medium text-foreground hover:text-[var(--contrazy-teal)]">
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
              {vendor.transactionCount} tx · {vendor.clientCount} clients
            </span>,
            <StatusBadge key={`${vendor.id}-status`} tone={getStatusTone(vendor.reviewStatus)}>
              {vendor.reviewStatus}
            </StatusBadge>,
            vendor.joinedAt,
            <VendorQuickReview key={`${vendor.id}-actions`} userId={vendor.userId} currentStatus={vendor.reviewStatus} />,
          ])}
          emptyMessage="No vendor accounts have been registered yet."
        />
      </PagePanel>
    </div>
  )
}

export function AdminUsersView({
  data,
  searchParams,
}: {
  data: AdminUserListData
  searchParams?: Record<string, string>
}) {
  const { users, totalCount, page, pageSize, totalPages } = data

  return (
    <PagePanel
      title="All users"
      description={`${totalCount} registered account${totalCount !== 1 ? "s" : ""}. Vendor accounts can be approved directly from this table.`}
    >
      <TablePageSection
        basePath="/admin/users"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by name, email, or business"
        filters={[
          { name: "role", label: "Role", value: searchParams?.role, options: adminRoleOptions },
          { name: "reviewStatus", label: "Review", value: searchParams?.reviewStatus, options: adminReviewStatusOptions },
        ]}
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        searchParams={searchParams}
        columns={["Name / Email", "Role", "Business", "Review status", "Joined", "Quick actions"]}
        rows={users.map((user) => [
          <div key={`${user.id}-name`}>
            <Link
              href={`/admin/users/${user.id}`}
              className="font-medium text-foreground hover:text-[var(--contrazy-teal)]"
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
              className="text-xs text-[var(--contrazy-teal)] hover:underline"
            >
              View →
            </Link>
          ),
        ])}
        emptyMessage="No user accounts have been created yet."
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

export function AdminUserDetailView({ user }: { user: AdminUserDetailRecord }) {
  const vp = user.vendorProfile

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--contrazy-teal)]/10 text-lg font-bold text-[var(--contrazy-teal)] ring-2 ring-[var(--contrazy-teal)]/20">
              {userInitials(user.name)}
            </div>

            {/* Identity */}
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
                <span>Joined {user.joinedAt}</span>
                {user.emailVerified ? (
                  <span className="text-emerald-600">✓ Email verified {user.emailVerified}</span>
                ) : (
                  <span className="text-amber-600">⚠ Email not verified</span>
                )}
                <span className="hidden sm:inline font-mono opacity-60">ID: {user.id}</span>
              </div>
            </div>

            {/* Vendor KPI strip */}
            {vp ? (
              <div className="flex shrink-0 gap-5 rounded-xl border border-border bg-muted/40 px-5 py-3 sm:flex-col sm:gap-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{vp.transactionCount}</p>
                  <p className="text-[11px] text-muted-foreground">Transactions</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{vp.clientCount}</p>
                  <p className="text-[11px] text-muted-foreground">Clients</p>
                </div>
                <div className="text-center">
                  <p className={`text-xl font-bold ${vp.profileCompletion === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                    {vp.profileCompletion}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">Profile</p>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Account + Role row */}
      <div className="grid gap-6 xl:grid-cols-2">
        <PagePanel title="Account details" description="Login credentials and verification status.">
          <DetailGrid
            items={[
              { label: "Full name", value: user.name },
              { label: "Email", value: user.email },
              { label: "Company", value: user.company || "—" },
              {
                label: "Account status",
                value: <StatusBadge tone={getStatusTone(user.status)}>{user.status}</StatusBadge>,
              },
              { label: "Email verified", value: user.emailVerified ?? "Not verified" },
              { label: "Joined", value: user.joinedAt },
            ]}
          />
        </PagePanel>

        <PagePanel title="Role management" description="Change the access level. Super Admin can only be granted by a Super Admin.">
          <UserRoleActions userId={user.id} currentRole={user.role} />
        </PagePanel>
      </div>

      {/* Business profile */}
      {vp ? (
        <PagePanel title="Business profile" description="Submitted business details and vendor review controls.">
          <div className="space-y-6">
            <DetailGrid
              items={[
                { label: "Business name", value: vp.businessName || "—" },
                { label: "Business email", value: vp.businessEmail || "—" },
                { label: "Support email", value: vp.supportEmail || "—" },
                { label: "Phone", value: vp.businessPhone || "—" },
                { label: "Address", value: vp.businessAddress || "—" },
                { label: "Country", value: vp.businessCountry || "—" },
                {
                  label: "Payout (Stripe)",
                  value: (
                    <StatusBadge tone={getStatusTone(vp.stripeConnectionStatus)}>
                      {vp.stripeConnectionStatus}
                    </StatusBadge>
                  ),
                },
                { label: "Profile complete", value: `${vp.profileCompletion}%` },
              ]}
            />

            <div className="border-t border-border pt-5">
              <p className="mb-3 text-sm font-semibold text-foreground">Review status</p>
              <VendorReviewActions userId={user.id} currentStatus={vp.reviewStatus} />
            </div>
          </div>
        </PagePanel>
      ) : null}

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 dark:border-red-900 dark:bg-red-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">Danger zone</h3>
            <p className="mt-1 max-w-prose text-sm text-red-700 dark:text-red-500">
              Permanently deletes this account and all associated data including vendor profiles, transactions, and clients. Active transactions must be resolved first.
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

export function AdminInvitesView({
  data,
  searchParams,
}: {
  data: AdminInviteListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Invitations" description="Track outstanding invites for vendors and internal team members.">
      <TablePageSection
        basePath="/admin/invites"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by invite email"
        filters={[
          { name: "role", label: "Role", value: searchParams?.role, options: adminRoleOptions },
          { name: "status", label: "Status", value: searchParams?.status, options: adminInviteStatusOptions },
        ]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Email", "Role", "Status", "Expires"]}
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
        emptyMessage="No invitations have been sent yet."
      />
    </PagePanel>
  )
}

export function AdminRolesView({ workspace }: { workspace: AdminWorkspaceRecord }) {
  return (
    <PagePanel title="Access levels" description="The platform uses a fixed set of access levels to keep reviews and operations separate.">
      <ResourceCards
        items={workspace.rolePolicies}
        emptyTitle="No access levels configured"
        emptyDescription="Access levels will appear here once the platform rules are available."
      />
    </PagePanel>
  )
}

export function AdminLogsView({
  data,
  searchParams,
}: {
  data: AdminLogListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Activity logs" description="Recent platform and operator activity.">
      <TablePageSection
        basePath="/admin/logs"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by actor, action, entity, provider, or event"
        filters={[{ name: "source", label: "Source", value: searchParams?.source, options: adminLogSourceOptions }]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["Actor", "Action", "Entity", "Date"]}
        rows={data.items.map((log) => [log.actor, log.action, log.entity, log.date])}
        emptyMessage="No activity has been recorded yet."
      />
    </PagePanel>
  )
}

export function AdminSessionsView({
  data,
  searchParams,
}: {
  data: AdminSessionListData
  searchParams?: Record<string, string>
}) {
  return (
    <PagePanel title="Sessions" description="Review current sign-in activity across the platform team.">
      <TablePageSection
        basePath="/admin/sessions"
        searchValue={searchParams?.q}
        searchPlaceholder="Search by user name or email"
        filters={[
          { name: "role", label: "Role", value: searchParams?.role, options: adminRoleOptions },
          { name: "state", label: "State", value: searchParams?.state, options: adminSessionStateOptions },
        ]}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalCount={data.totalCount}
        pageSize={data.pageSize}
        searchParams={searchParams}
        columns={["User", "Role", "State", "Last seen"]}
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
        emptyMessage="Session activity will appear here as people sign in."
      />
    </PagePanel>
  )
}
