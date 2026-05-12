"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
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
import type { TransactionCreationInitialValues } from "@/features/dashboard/transaction-creation"
import type {
  VendorActionsUsageRecord,
  VendorLinkRecord,
} from "@/features/dashboard/server/dashboard-data"
import { cn } from "@/lib/utils"

type VendorCreateLinkDialogProps = {
  contracts: ContractTemplate[]
  checklists: Array<ChecklistTemplate & { items: ChecklistItem[] }>
  mode?: "new" | "recreate" | "bulk"
  initialValues?: TransactionCreationInitialValues | null
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
  }) => ReactNode
}

const dialogShellClass = cn(
  "flex h-[100dvh] max-w-none flex-col overflow-hidden rounded-none border-0 bg-background p-0 text-foreground shadow-none ring-0",
  "sm:h-[min(88dvh,760px)] sm:max-h-[88dvh] sm:max-w-[880px] sm:rounded-md sm:border sm:border-border"
)

const iconButtonClass =
  "h-8 w-8 cursor-pointer rounded-sm border-border shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"

const footerButtonClass =
  "h-9 cursor-pointer rounded-sm shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"

export function VendorCreateLinkDialog({
  contracts,
  checklists,
  mode = "new",
  initialValues = null,
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
  const createBadge = createSuccess
    ? t("createModal.statusCreated")
    : createDirty
      ? t("createModal.statusDraft")
      : mode === "recreate"
        ? t("createModal.statusRecreate")
        : mode === "bulk"
          ? t("createModal.statusBulk")
        : t("createModal.statusNew")
  const modalTitle =
    mode === "recreate"
      ? t("createModal.recreateTitle")
      : mode === "bulk"
        ? t("createModal.bulkTitle")
        : t("createModal.title")
  const modalDescription =
    mode === "recreate"
      ? t("createModal.recreateDescription")
      : mode === "bulk"
        ? t("createModal.bulkDescription")
      : t("createModal.description")

  function resetCreateState() {
    setDiscardOpen(false)
    setCreateDirty(false)
    setCreateSuccess(false)
    setFormInstance((current) => current + 1)
  }

  function openDialog() {
    if (createBlockedReason) return
    setCreateOpen(true)
  }

  function closeDialog(discardChanges = false) {
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

  function handleCreatedLink(
    nextRecord: VendorLinkRecord,
    nextUsage: VendorActionsUsageRecord | null
  ) {
    setUsageState(nextUsage)
    onLinkCreated?.(nextRecord, nextUsage)
  }

  function handleUsageUpdated(nextUsage: VendorActionsUsageRecord | null) {
    setUsageState(nextUsage)
  }

  return (
    <>
      {renderTrigger?.({
        openDialog,
        disabled: Boolean(createBlockedReason),
        blockedReason: createBlockedReason,
      })}

      <Dialog open={createOpen} onOpenChange={handleOpenChange}>
        <DialogContent className={dialogShellClass} showCloseButton={false}>
          <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
            <DialogHeader className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {createBadge}
                    </span>
                    <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                      {modalTitle}
                    </DialogTitle>
                  </div>

                  <DialogDescription className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                    {modalDescription}
                  </DialogDescription>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn(iconButtonClass, "shrink-0")}
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
                  mode={mode}
                  initialValues={initialValues}
                  usage={usageState}
                  hasStripe={hasStripe}
                  canLaunch={canLaunch}
                  blockedMessage={blockedMessage}
                  onLinkCreated={handleCreatedLink}
                  onUsageUpdated={handleUsageUpdated}
                  onDirtyChange={setCreateDirty}
                  onSuccessStateChange={setCreateSuccess}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent
          className="max-w-[calc(100vw-2rem)] gap-0 overflow-hidden rounded-md border border-border bg-background p-0 text-foreground shadow-none sm:max-w-[384px]"
          showCloseButton={false}
        >
          <div className="flex flex-col">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <DialogHeader className="min-w-0 space-y-1 text-left">
                  <DialogTitle className="text-base font-semibold tracking-tight text-foreground">
                    {t("discardModal.title")}
                  </DialogTitle>
                  <DialogDescription className="text-xs leading-5 text-muted-foreground">
                    {t("discardModal.description")}
                  </DialogDescription>
                </DialogHeader>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn(iconButtonClass, "shrink-0")}
                  onClick={() => setDiscardOpen(false)}
                >
                  <X className="size-4" />
                  <span className="sr-only">{t("createModal.closeLabel")}</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 bg-muted/20 px-4 py-3">
              <Button
                type="button"
                variant="outline"
                className={cn(footerButtonClass, "border-border bg-background")}
                onClick={() => setDiscardOpen(false)}
              >
                {t("discardModal.keepEditing")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className={footerButtonClass}
                onClick={() => closeDialog(true)}
              >
                {t("discardModal.discard")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
