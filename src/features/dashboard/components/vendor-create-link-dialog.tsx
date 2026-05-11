"use client"

import { useEffect, useState } from "react"
import type { ChecklistItem, ChecklistTemplate, ContractTemplate } from "@prisma/client"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TransactionCreationForm } from "@/features/dashboard/components/transaction-creation-form"
import type {
  VendorActionsUsageRecord,
  VendorLinkRecord,
} from "@/features/dashboard/server/dashboard-data"

type VendorCreateLinkDialogProps = {
  contracts: ContractTemplate[]
  checklists: Array<ChecklistTemplate & { items: ChecklistItem[] }>
  usage: VendorActionsUsageRecord | null
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  defaultOpen?: boolean
  onLinkCreated?: (record: VendorLinkRecord, usage: VendorActionsUsageRecord | null) => void
  renderTrigger?: (props: {
    openDialog: () => void
    disabled: boolean
    blockedReason: string | null
  }) => React.ReactNode
}

export function VendorCreateLinkDialog({
  contracts,
  checklists,
  usage,
  hasStripe,
  canLaunch,
  blockedMessage,
  defaultOpen = false,
  onLinkCreated,
  renderTrigger,
}: VendorCreateLinkDialogProps) {
  const t = useTranslations("dashboard.vendor.linkWorkspace")
  const [usageState, setUsageState] = useState(usage)
  const [createOpen, setCreateOpen] = useState(defaultOpen)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [createDirty, setCreateDirty] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [formInstance, setFormInstance] = useState(0)

  useEffect(() => {
    setUsageState(usage)
  }, [usage])

  const transactionLimitReached =
    usageState?.transactions.remaining !== null &&
    (usageState?.transactions.remaining ?? 0) <= 0

  const createBlockedReason = !canLaunch
    ? blockedMessage
    : !hasStripe
      ? t("blockedMessages.noStripe")
      : transactionLimitReached
        ? t("blockedMessages.quotaFull")
        : null

  function resetCreateState() {
    setDiscardOpen(false)
    setCreateDirty(false)
    setCreateSuccess(false)
    setFormInstance((current) => current + 1)
  }

  function openDialog() {
    if (createBlockedReason) {
      return
    }

    setCreateOpen(true)
  }

  function closeDialog(discardChanges: boolean = false) {
    setCreateOpen(false)

    if (discardChanges) {
      resetCreateState()
      return
    }

    resetCreateState()
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      openDialog()
      return
    }

    if (createDirty && !createSuccess) {
      setDiscardOpen(true)
      return
    }

    closeDialog()
  }

  function handleCreatedLink(nextRecord: VendorLinkRecord, nextUsage: VendorActionsUsageRecord | null) {
    setUsageState(nextUsage)
    onLinkCreated?.(nextRecord, nextUsage)
  }

  return (
    <>
      {renderTrigger?.({
        openDialog,
        disabled: Boolean(createBlockedReason),
        blockedReason: createBlockedReason,
      })}

      <Dialog open={createOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex h-[100dvh] max-w-none flex-col overflow-hidden rounded-none border-0 bg-background p-0 shadow-none ring-0 sm:h-[min(92dvh,960px)] sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-[28px] sm:border sm:border-border/70 sm:shadow-[0_32px_80px_-40px_rgba(15,23,42,0.45)]"
          showCloseButton={false}
        >
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="text-[1.05rem] font-semibold tracking-tight">
                    {t("createModal.title")}
                  </DialogTitle>
                  <DialogDescription className="mt-1 max-w-3xl text-[13px] leading-5">
                    {t("createModal.description")}
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  onClick={() => handleOpenChange(false)}
                >
                  <X className="size-4" />
                  <span className="sr-only">{t("createModal.closeLabel")}</span>
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
            <DialogTitle>{t("discardModal.title")}</DialogTitle>
            <DialogDescription>{t("discardModal.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)}>
              {t("discardModal.keepEditing")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => closeDialog(true)}>
              {t("discardModal.discard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
