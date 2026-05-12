"use client"

import type { ChecklistItem, ChecklistTemplate, ContractTemplate } from "@prisma/client"
import { RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { VendorCreateLinkDialog } from "@/features/dashboard/components/vendor-create-link-dialog"
import type { TransactionCreationInitialValues } from "@/features/dashboard/transaction-creation"
import type { VendorActionsUsageRecord } from "@/features/dashboard/server/dashboard-data"

type RecreateTransactionActionProps = {
  contracts: ContractTemplate[]
  checklists: Array<ChecklistTemplate & { items: ChecklistItem[] }>
  initialValues: TransactionCreationInitialValues
  usage: VendorActionsUsageRecord | null
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
}

export function RecreateTransactionAction({
  contracts,
  checklists,
  initialValues,
  usage,
  hasStripe,
  canLaunch,
  blockedMessage,
}: RecreateTransactionActionProps) {
  const t = useTranslations("dashboard.vendor.transactionDetailPage")

  return (
    <VendorCreateLinkDialog
      contracts={contracts}
      checklists={checklists}
      mode="recreate"
      initialValues={initialValues}
      usage={usage}
      hasStripe={hasStripe}
      canLaunch={canLaunch}
      blockedMessage={blockedMessage}
      renderTrigger={({ openDialog, disabled, blockedReason }) => (
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={openDialog}
          disabled={disabled}
          title={blockedReason ?? undefined}
        >
          <RotateCcw className="mr-2 size-4" />
          {t("recreateAction.button")}
        </Button>
      )}
    />
  )
}
