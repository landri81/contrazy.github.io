"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Download, ExternalLink, Loader2, MoreHorizontal, PencilLine, QrCode, ShieldX, WandSparkles } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { VendorActionsUsageRecord, VendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

function toDateTimeLocal(value: string | null) {
  if (!value) return ""

  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

type PaymentLinkManagementActionsProps = {
  record: VendorLinkRecord
  variant?: "compact" | "detail"
  onRecordChange?: (record: VendorLinkRecord) => void
  onUsageChange?: (usage: VendorActionsUsageRecord | null) => void
}

export function PaymentLinkManagementActions({
  record,
  variant = "compact",
  onRecordChange,
  onUsageChange,
}: PaymentLinkManagementActionsProps) {
  const router = useRouter()
  const qrContainerRef = useRef<HTMLDivElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrPreviewRecord, setQrPreviewRecord] = useState<VendorLinkRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [title, setTitle] = useState(record.title)
  const [notes, setNotes] = useState(record.notes ?? "")
  const [expiresAt, setExpiresAt] = useState(toDateTimeLocal(record.expiresAt))

  const detailHref = useMemo(() => `/vendor/transactions/${record.transactionId}`, [record.transactionId])
  const qrDialogRecord = qrPreviewRecord ?? record

  function openEditDialog() {
    setTitle(record.title)
    setNotes(record.notes ?? "")
    setExpiresAt(toDateTimeLocal(record.expiresAt))
    setError(null)
    setEditOpen(true)
  }

  function handleQrOpenChange(nextOpen: boolean) {
    setQrOpen(nextOpen)

    if (!nextOpen) {
      setQrPreviewRecord(null)
    }
  }

  function openQrPreview(nextRecord: VendorLinkRecord = record) {
    setQrPreviewRecord(nextRecord)
    setQrOpen(true)
  }

  function applyUpdatedRecord(nextRecord: VendorLinkRecord) {
    if (onRecordChange) {
      onRecordChange(nextRecord)
      return
    }

    router.refresh()
  }

  function applyUsage(nextUsage: VendorActionsUsageRecord | null | undefined) {
    onUsageChange?.(nextUsage ?? null)
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(record.shareLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch (err) {
      console.error(err)
    }
  }

  function downloadQr() {
    const svg = qrContainerRef.current?.querySelector("svg")

    if (!svg) {
      return
    }

    const markup = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${qrDialogRecord.reference.toLowerCase()}-qr.svg`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleGenerateQr() {
    setIsGeneratingQr(true)
    setError(null)

    try {
      const response = await fetch(`/api/vendor/links/${record.id}/qr`, {
        method: "POST",
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.message ?? "Unable to generate this QR code.")
        return
      }

      const nextRecord = payload?.item ?? record

      if (payload?.item) {
        applyUpdatedRecord(payload.item)
      }
      applyUsage(payload?.actionUsage)
      openQrPreview(nextRecord)
    } catch (err) {
      console.error(err)
      setError("Unable to generate this QR code.")
    } finally {
      setIsGeneratingQr(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/vendor/links/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.message ?? "Unable to update this payment link.")
        return
      }

      applyUpdatedRecord(payload.item)
      setEditOpen(false)
    } catch (err) {
      console.error(err)
      setError("Unable to update this payment link.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancelLink() {
    setIsCancelling(true)
    setError(null)

    try {
      const response = await fetch(`/api/vendor/links/${record.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.message ?? "Unable to cancel this payment link.")
        return
      }

      applyUpdatedRecord(payload.item)
      setCancelOpen(false)
      setCancelReason("")
    } catch (err) {
      console.error(err)
      setError("Unable to cancel this payment link.")
    } finally {
      setIsCancelling(false)
    }
  }

  const actionButtons = (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={detailHref}
          className={cn(
            buttonVariants({ variant: "outline", size: variant === "detail" ? "sm" : "icon-sm" }),
            "cursor-pointer"
          )}
          title="Open transaction detail"
        >
          <ExternalLink className="size-3.5" />
          {variant === "detail" ? "Transaction" : null}
        </Link>
        <Button
          type="button"
          variant="outline"
          size={variant === "detail" ? "sm" : "icon-sm"}
          onClick={copyShareLink}
          title="Copy secure link"
        >
          <Copy className="size-3.5" />
          {variant === "detail" ? (copied ? "Copied" : "Copy link") : null}
        </Button>
        {variant === "detail" && !record.qrReady && record.canGenerateQr ? (
          <Button type="button" variant="outline" size="sm" onClick={handleGenerateQr} disabled={isGeneratingQr}>
            {isGeneratingQr ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
            {isGeneratingQr ? "Generating..." : "Generate QR"}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open payment link actions"
            aria-busy={isGeneratingQr}
            disabled={isGeneratingQr}
            className={cn(
              buttonVariants({ variant: "outline", size: variant === "detail" ? "sm" : "icon-sm" }),
              "cursor-pointer"
            )}
          >
            {isGeneratingQr ? <Loader2 className="size-3.5 animate-spin" /> : <MoreHorizontal className="size-3.5" />}
            {variant === "detail" ? (isGeneratingQr ? "Generating..." : "More") : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => window.open(record.shareLink, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="size-4" />
              Open customer link
            </DropdownMenuItem>
            {record.qrReady ? (
              <DropdownMenuItem className="cursor-pointer" onClick={() => openQrPreview(record)}>
                <QrCode className="size-4" />
                Preview QR code
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={!record.canGenerateQr || isGeneratingQr}
                onClick={handleGenerateQr}
                title={record.qrUnavailableReason ?? undefined}
              >
                {isGeneratingQr ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
                {isGeneratingQr ? "Generating QR..." : "Generate QR code"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={!record.canEdit}
              onClick={openEditDialog}
            >
              <PencilLine className="size-4" />
              Edit link
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={!record.canCancel}
              variant="destructive"
              onClick={() => setCancelOpen(true)}
            >
              <ShieldX className="size-4" />
              Cancel link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {variant === "detail" && !record.qrReady ? (
        <p className="text-right text-xs text-muted-foreground">
          {record.canGenerateQr
            ? "Create the QR only when you need an in-person scan flow."
            : record.qrUnavailableReason ?? "QR is not available for this link."}
        </p>
      ) : null}
      {error && !editOpen && !cancelOpen ? (
        <p className="text-right text-xs text-destructive">{error}</p>
      ) : null}

      <Dialog open={qrOpen} onOpenChange={handleQrOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR code</DialogTitle>
            <DialogDescription>
              Share this secure QR code for {qrDialogRecord.reference}. The code resolves to the current customer link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {qrDialogRecord.qrCodeSvg ? (
              <div
                ref={qrContainerRef}
                className="flex justify-center rounded-2xl border bg-white p-6 [&_svg]:block [&_svg]:h-[220px] [&_svg]:w-[220px]"
                dangerouslySetInnerHTML={{ __html: qrDialogRecord.qrCodeSvg }}
              />
            ) : (
              <div className="rounded-2xl border border-dashed bg-muted/25 p-5 text-sm text-muted-foreground">
                No QR has been generated for this link yet.
              </div>
            )}
            <div className="rounded-xl border bg-muted/25 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{qrDialogRecord.shortCode}</p>
              <p className="mt-1 break-all">{qrDialogRecord.shareLink}</p>
            </div>
          </div>
          <DialogFooter>
            {qrDialogRecord.qrCodeSvg ? (
              <Button type="button" variant="outline" onClick={downloadQr}>
                <Download className="size-4" />
                Download SVG
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  return (
    <>
      {actionButtons}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit payment link</DialogTitle>
            <DialogDescription>
              Update the customer-facing title, internal notes, and optional access deadline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor={`link-title-${record.id}`}>Title</Label>
              <Input
                id={`link-title-${record.id}`}
                value={title}
                maxLength={INPUT_LIMITS.linkTitle}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Transaction title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`link-expiry-${record.id}`}>Access deadline</Label>
              <Input
                id={`link-expiry-${record.id}`}
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`link-notes-${record.id}`}>Internal notes</Label>
              <Textarea
                id={`link-notes-${record.id}`}
                value={notes}
                maxLength={INPUT_LIMITS.linkNotes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional internal context"
                rows={4}
              />
              <CharacterCount current={notes.length} limit={INPUT_LIMITS.linkNotes} className="text-right" />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={isSaving}>
              Close
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel payment link</DialogTitle>
            <DialogDescription>
              This closes the secure link immediately and prevents the customer from continuing the workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor={`cancel-reason-${record.id}`}>Reason</Label>
              <Textarea
                id={`cancel-reason-${record.id}`}
                value={cancelReason}
                maxLength={INPUT_LIMITS.cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Optional reason for this cancellation"
                rows={3}
              />
              <CharacterCount current={cancelReason.length} limit={INPUT_LIMITS.cancelReason} className="text-right" />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)} disabled={isCancelling}>
              Keep active
            </Button>
            <Button type="button" variant="destructive" onClick={handleCancelLink} disabled={isCancelling}>
              {isCancelling ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancel link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
