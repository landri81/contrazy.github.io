"use client"

import Link from "next/link"
import { useState } from "react"
import type { ChecklistTemplate, ContractTemplate } from "@prisma/client"

import { DashboardTable, PagePanel, StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import { PaymentLinkManagementActions } from "@/features/dashboard/components/payment-link-management-actions"
import { TransactionCreationForm } from "@/features/dashboard/components/transaction-creation-form"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import type { VendorLinkRecord } from "@/features/dashboard/server/dashboard-data"

type VendorLinkWorkspaceProps = {
  contracts: ContractTemplate[]
  checklists: ChecklistTemplate[]
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  initialLinks: VendorLinkRecord[]
}

function isLiveStatus(status: string) {
  return status === "ACTIVE" || status === "PROCESSING"
}

export function VendorLinkWorkspace({
  contracts,
  checklists,
  hasStripe,
  canLaunch,
  blockedMessage,
  initialLinks,
}: VendorLinkWorkspaceProps) {
  const [recentLinks, setRecentLinks] = useState(initialLinks)

  const activeCount = recentLinks.filter((item) => item.status === "ACTIVE").length
  const processingCount = recentLinks.filter((item) => item.status === "PROCESSING").length

  function handleCreatedLink(nextRecord: VendorLinkRecord) {
    setRecentLinks((current) => {
      const next = [nextRecord, ...current.filter((item) => item.id !== nextRecord.id)]
      return next.filter((item) => isLiveStatus(item.status)).slice(0, 6)
    })
  }

  function handleRecordChange(nextRecord: VendorLinkRecord) {
    setRecentLinks((current) => {
      const next = current.map((item) => (item.id === nextRecord.id ? nextRecord : item))
      return next.filter((item) => isLiveStatus(item.status))
    })
  }

  return (
    <div className="space-y-6">
      

      <div className="space-y-6">
        <div className="">
          <TransactionCreationForm
            contracts={contracts}
            checklists={checklists}
            hasStripe={hasStripe}
            canLaunch={canLaunch}
            blockedMessage={blockedMessage}
            onLinkCreated={handleCreatedLink}
          />
        </div>

        <PagePanel
          title="Recent payment links"
          description="Manage your latest active and processing client links from one place."
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

                <div key={`${record.id}-title`} className="min-w-[180px]">
                  <p className="font-medium text-foreground">{record.title}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {record.kind.replaceAll("_", " ").toLowerCase()}
                  </p>
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
                  key={`${record.id}-${record.status}-${record.title}-${record.expiresAt ?? "none"}`}
                  record={record}
                  onRecordChange={handleRecordChange}
                />,
              ])}
              emptyMessage="No active or processing links are waiting right now."
            />
          </div>
        </PagePanel>
      </div>
    </div>
  )
}