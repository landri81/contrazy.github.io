"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type KycVerificationRecord = {
  id: string
  provider: string
  status: string
  providerReference: string | null
  summary: string | null
  verifiedAt: Date | null
  createdAt: Date
}

type KycReviewCardProps = {
  transactionId: string
  kyc: KycVerificationRecord
}

function statusStyle(status: string) {
  switch (status) {
    case "VERIFIED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700"
    default:
      return "border-slate-200 bg-slate-100 text-slate-600"
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "VERIFIED": return "Verified"
    case "PENDING": return "Pending review"
    case "FAILED": return "Failed / Rejected"
    default: return status
  }
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url) || url.includes("cloudinary")
}

export function KycReviewCard({ transactionId, kyc }: KycReviewCardProps) {
  const router = useRouter()
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "request_again" | null>(null)
  const [loading, setLoading] = useState(false)

  const isManualPending = kyc.provider === "Manual" && kyc.status === "PENDING"
  const isManualFailed = kyc.provider === "Manual" && kyc.status === "FAILED"
  const documentUrl = kyc.provider === "Manual" ? kyc.summary : null
  const isPdf = documentUrl ? documentUrl.includes(".pdf") || documentUrl.includes("/raw/") : false

  async function runAction(action: "approve" | "reject" | "request_again") {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendor/transactions/${transactionId}/kyc`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      setConfirmAction(null)
      if (!res.ok) {
        toast({ variant: "error", title: "Action failed", description: data.message ?? "Try again." })
        return
      }
      const messages = {
        approve: "Identity document approved. Transaction proceeding.",
        reject: "Document rejected.",
        request_again: "Client will be asked to resubmit their document.",
      }
      toast({ variant: "success", title: "Done", description: messages[action] })
      router.refresh()
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setLoading(false)
    }
  }

  const confirmMeta = {
    approve: {
      title: "Approve identity document",
      description: "The client's KYC verification will be marked as verified and the transaction will proceed.",
      confirmLabel: "Approve",
      confirmClass: "bg-emerald-600 text-white hover:bg-emerald-700",
    },
    reject: {
      title: "Reject identity document",
      description: "The document will be marked as failed. The client can re-upload, but the transaction will not proceed until you approve a document.",
      confirmLabel: "Reject",
      confirmClass: "bg-destructive text-white hover:bg-destructive/90",
    },
    request_again: {
      title: "Request new document",
      description: "The current submission will be cleared. The client will be prompted to upload a new identity document.",
      confirmLabel: "Request again",
      confirmClass: "bg-amber-600 text-white hover:bg-amber-700",
    },
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" />
                Identity Verification
              </CardTitle>
              <CardDescription>
                {kyc.provider === "Manual" ? "Manual document review" : "Stripe Identity (automated)"}
              </CardDescription>
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                statusStyle(kyc.status)
              )}
            >
              {statusLabel(kyc.status)}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Provider</p>
              <p className="font-medium">{kyc.provider}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Submitted</p>
              <p className="font-medium">
                {kyc.createdAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            {kyc.verifiedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Verified at</p>
                <p className="font-medium">
                  {kyc.verifiedAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            {kyc.providerReference && kyc.provider !== "Manual" && (
              <div>
                <p className="text-xs text-muted-foreground">Session ID</p>
                <p className="font-mono text-xs text-muted-foreground truncate">{kyc.providerReference}</p>
              </div>
            )}
          </div>

          {/* Document preview — manual only */}
          {documentUrl && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-[13px] font-medium text-foreground">Submitted document</span>
                </div>
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--contrazy-teal)] hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Open
                </a>
              </div>

              {isPdf ? (
                <div className="flex items-center justify-center gap-2 py-6 bg-muted/10 text-sm text-muted-foreground">
                  <FileText className="size-5" />
                  PDF document —{" "}
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--contrazy-teal)] hover:underline"
                  >
                    click to open
                  </a>
                </div>
              ) : isImageUrl(documentUrl) ? (
                <div className="bg-muted/10 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={documentUrl}
                    alt="Identity document"
                    className="max-h-64 w-full rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-6 bg-muted/10 text-sm text-muted-foreground">
                  <ExternalLink className="size-4" />
                  <a
                    href={documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--contrazy-teal)] hover:underline"
                  >
                    View document
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Stripe Identity — automated, no manual actions */}
          {kyc.provider !== "Manual" && kyc.status === "VERIFIED" && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Automatically verified</p>
                <p className="text-xs text-emerald-700/80">Stripe Identity confirmed the customer record.</p>
              </div>
            </div>
          )}

          {kyc.provider !== "Manual" && kyc.status === "FAILED" && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="size-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">Verification failed</p>
                <p className="text-xs text-red-700/80">Stripe Identity could not confirm the customer. The client can retry.</p>
              </div>
            </div>
          )}

          {/* Manual review actions */}
          {isManualPending && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => setConfirmAction("approve")}
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-50"
                onClick={() => setConfirmAction("request_again")}
              >
                <RefreshCw className="mr-1.5 size-4" />
                Request again
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={() => setConfirmAction("reject")}
              >
                <XCircle className="mr-1.5 size-4" />
                Reject
              </Button>
            </div>
          )}

          {isManualFailed && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <ShieldX className="size-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-800">
                Document rejected. The client can resubmit a new document via the client flow.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm modal */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!loading) { if (!open) setConfirmAction(null) } }}
      >
        <DialogContent className="sm:max-w-sm">
          {confirmAction && (
            <>
              <DialogHeader>
                <DialogTitle>{confirmMeta[confirmAction].title}</DialogTitle>
                <DialogDescription>{confirmMeta[confirmAction].description}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  className={confirmMeta[confirmAction].confirmClass}
                  onClick={() => runAction(confirmAction)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {confirmMeta[confirmAction].confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
