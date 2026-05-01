import Link from "next/link"

import { DetailGrid, DashboardTable, PagePanel, ResourceCards, StatusBadge, TimelineList } from "@/features/dashboard/components/dashboard-ui"
import { VendorReviewActions } from "@/features/dashboard/components/week-one-forms"
import type {
  AdminUserDetailRecord,
  AdminWorkspaceRecord,
  TransactionDetailRecord,
  WorkspaceRecord,
} from "@/features/dashboard/server/dashboard-data"
import { getDemoTone } from "@/features/dashboard/server/dashboard-data"

export function VendorActionsView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Action queue" description="Priority tasks to keep the account and customer flow moving.">
      <DashboardTable
        columns={["Priority", "Action", "Client", "Reference", "Due"]}
        rows={workspace.actionItems.map((item) => [
          <StatusBadge key={`${item.reference}-priority`} tone={getDemoTone(item.priority)}>
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

export function VendorTransactionsView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Transactions" description="Track every customer workflow from setup to payment and deposit handling.">
      <DashboardTable
        columns={["Client", "Reference", "Type", "Amount", "KYC", "Contract", "Status", "Date"]}
        rows={workspace.transactions.map((transaction) => [
          <div key={`${transaction.reference}-client`}>
            <p className="font-medium text-foreground">{transaction.clientName}</p>
            <p className="text-xs text-muted-foreground">{transaction.clientEmail}</p>
          </div>,
          <Link key={`${transaction.reference}-detail`} href={`/vendor/transactions/${transaction.id}`} className="font-medium text-foreground hover:text-[var(--contrazy-teal)]">
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

export function VendorKycView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Identity checks" description="Follow customer verification progress when identity confirmation is required.">
      <DashboardTable
        columns={["Client", "Reference", "Status", "Provider", "Note"]}
        rows={workspace.kycCases.map((record) => [
          record.client,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getDemoTone(record.status)}>
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

export function VendorSignaturesView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Signatures" description="See which customers have reviewed and accepted their agreements.">
      <DashboardTable
        columns={["Signer", "Reference", "Status", "Template", "Date"]}
        rows={workspace.signatures.map((record) => [
          record.signer,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getDemoTone(record.status)}>
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

export function VendorDepositsView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Deposits" description="Monitor active holds, expiry windows, and later release or capture decisions.">
      <DashboardTable
        columns={["Client", "Reference", "Amount", "Status", "Window"]}
        rows={workspace.deposits.map((record) => [
          record.client,
          record.reference,
          record.amount,
          <StatusBadge key={`${record.reference}-status`} tone={getDemoTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.date,
        ])}
        emptyMessage="No deposit activity yet."
      />
    </PagePanel>
  )
}

export function VendorPaymentsView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Payments" description="Review payment collection across your customer workflows.">
      <DashboardTable
        columns={["Client", "Reference", "Amount", "Status", "Date"]}
        rows={workspace.payments.map((record) => [
          record.client,
          record.reference,
          record.amount,
          <StatusBadge key={`${record.reference}-status`} tone={getDemoTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.date,
        ])}
        emptyMessage="No payments have been recorded yet."
      />
    </PagePanel>
  )
}

export function VendorDisputesView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Disputes" description="Track customer issues related to payments or deposits.">
      <DashboardTable
        columns={["Client", "Reference", "Status", "Summary"]}
        rows={workspace.disputes.map((record) => [
          record.client,
          record.reference,
          <StatusBadge key={`${record.reference}-status`} tone={getDemoTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.summary,
        ])}
        emptyMessage="No disputes have been opened."
      />
    </PagePanel>
  )
}

export function VendorClientsView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Clients" description="Review recent customers and the workflows connected to them.">
      <DashboardTable
        columns={["Client", "Email", "Status", "Recent transaction"]}
        rows={workspace.clients.map((record) => [
          record.name,
          record.email,
          <StatusBadge key={`${record.email}-status`} tone={getDemoTone(record.status)}>
            {record.status}
          </StatusBadge>,
          record.lastTransaction,
        ])}
        emptyMessage="No customer profiles have been captured yet."
      />
    </PagePanel>
  )
}

export function VendorLinksView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Customer links" description="Share secure links and QR codes for each customer workflow.">
      <DashboardTable
        columns={["Reference", "Share link", "Short code", "QR", "State"]}
        rows={workspace.links.map((record) => [
          record.reference,
          <Link key={`${record.reference}-share`} href={record.shareLink} className="font-medium text-foreground hover:text-[var(--contrazy-teal)]">
            Open secure link
          </Link>,
          record.shortCode,
          record.qrStatus,
          <StatusBadge key={`${record.reference}-state`} tone={getDemoTone(record.state)}>
            {record.state}
          </StatusBadge>,
        ])}
        emptyMessage="No customer links have been issued yet."
      />
    </PagePanel>
  )
}

export function VendorWebhooksView({ workspace }: { workspace: WorkspaceRecord }) {
  return (
    <PagePanel title="Event history" description="Review delivery events and payment updates connected to your account.">
      <DashboardTable
        columns={["Provider", "Event", "Status", "Date"]}
        rows={workspace.webhooks.map((record) => [
          record.provider,
          record.eventType,
          <StatusBadge key={`${record.eventType}-${record.date}`} tone={getDemoTone(record.status)}>
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
              value: <StatusBadge tone={getDemoTone(workspace.summary.reviewStatus)}>{workspace.summary.reviewStatus}</StatusBadge>,
            },
            {
              label: "Payout status",
              value: (
                <StatusBadge tone={getDemoTone(workspace.summary.stripeConnectionStatus)}>
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

export function AdminUsersView({ workspace }: { workspace: AdminWorkspaceRecord }) {
  return (
    <PagePanel title="Users" description="Review everyone with access to the platform and their current account status.">
      <DashboardTable
        columns={["Name", "Email", "Role", "Company", "Status"]}
        rows={workspace.users.map((user) => [
          <Link key={`${user.id}-name`} href={`/admin/users/${user.id}`} className="font-medium text-foreground hover:text-[var(--contrazy-teal)]">
            {user.name}
          </Link>,
          user.email,
          <StatusBadge key={`${user.id}-role`} tone={getDemoTone(user.role)}>
            {user.role}
          </StatusBadge>,
          user.company,
          <StatusBadge key={`${user.id}-status`} tone={getDemoTone(user.status)}>
            {user.status}
          </StatusBadge>,
        ])}
        emptyMessage="No user accounts have been created yet."
      />
    </PagePanel>
  )
}

export function AdminUserDetailView({ user }: { user: AdminUserDetailRecord }) {
  return (
    <div className="space-y-6">
      <PagePanel title={`User detail · ${user.name}`} description="Account, role, and current business review status.">
        <DetailGrid
          items={[
            { label: "Name", value: user.name },
            { label: "Email", value: user.email },
            { label: "Role", value: user.role },
            { label: "Company", value: user.company },
            { label: "Status", value: user.status },
            { label: "User id", value: user.id },
          ]}
        />
      </PagePanel>

      {user.vendorProfile ? (
        <PagePanel title="Business profile" description="Review the submitted business details and update the account status.">
          <div className="space-y-6">
            <DetailGrid
              items={[
                { label: "Business name", value: user.vendorProfile.businessName },
                { label: "Business email", value: user.vendorProfile.businessEmail },
                { label: "Support email", value: user.vendorProfile.supportEmail },
                { label: "Phone", value: user.vendorProfile.businessPhone },
                { label: "Address", value: user.vendorProfile.businessAddress },
                { label: "Country", value: user.vendorProfile.businessCountry },
                {
                  label: "Review status",
                  value: <StatusBadge tone={getDemoTone(user.vendorProfile.reviewStatus)}>{user.vendorProfile.reviewStatus}</StatusBadge>,
                },
                {
                  label: "Payout status",
                  value: <StatusBadge tone={getDemoTone(user.vendorProfile.stripeConnectionStatus)}>{user.vendorProfile.stripeConnectionStatus}</StatusBadge>,
                },
                { label: "Profile completion", value: `${user.vendorProfile.profileCompletion}%` },
              ]}
            />

            <VendorReviewActions userId={user.id} currentStatus={user.vendorProfile.reviewStatus} />
          </div>
        </PagePanel>
      ) : null}
    </div>
  )
}

export function AdminInvitesView({ workspace }: { workspace: AdminWorkspaceRecord }) {
  return (
    <PagePanel title="Invitations" description="Track outstanding invites for vendors and internal team members.">
      <DashboardTable
        columns={["Email", "Role", "Status", "Expires"]}
        rows={workspace.invites.map((invite) => [
          invite.email,
          <StatusBadge key={`${invite.id}-role`} tone={getDemoTone(invite.role)}>
            {invite.role}
          </StatusBadge>,
          <StatusBadge key={`${invite.id}-status`} tone={getDemoTone(invite.status)}>
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

export function AdminLogsView({ workspace }: { workspace: AdminWorkspaceRecord }) {
  return (
    <PagePanel title="Activity logs" description="Recent platform and operator activity.">
      <DashboardTable
        columns={["Actor", "Action", "Entity", "Date"]}
        rows={workspace.logs.map((log) => [log.actor, log.action, log.entity, log.date])}
        emptyMessage="No activity has been recorded yet."
      />
    </PagePanel>
  )
}

export function AdminSessionsView({ workspace }: { workspace: AdminWorkspaceRecord }) {
  return (
    <PagePanel title="Sessions" description="Review current sign-in activity across the platform team.">
      <DashboardTable
        columns={["User", "Role", "State", "Last seen"]}
        rows={workspace.sessions.map((session) => [
          session.user,
          <StatusBadge key={`${session.user}-role`} tone={getDemoTone(session.role)}>
            {session.role}
          </StatusBadge>,
          <StatusBadge key={`${session.user}-state`} tone={getDemoTone(session.state)}>
            {session.state}
          </StatusBadge>,
          session.lastSeen,
        ])}
        emptyMessage="Session activity will appear here as people sign in."
      />
    </PagePanel>
  )
}
