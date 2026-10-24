"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
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
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
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

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)
}

export function KycReviewCard({ transactionId, kyc }: KycReviewCardProps) {
  const router = useRouter()
  const t = useTranslations("dashboard.vendor.kycReview")
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "request_again" | null>(null)
  const [loading, setLoading] = useState(false)

  const isManualPending = kyc.provider === "Manual" && kyc.status === "PENDING"
  const isManualFailed = kyc.provider === "Manual" && kyc.status === "FAILED"
  const documentUrl = kyc.provider === "Manual" ? kyc.summary : null
  const isPdf = documentUrl ? documentUrl.includes(".pdf") || documentUrl.includes("/raw/") : false
  const documentHref = resolveDocumentAssetUrl(documentUrl)

  function statusLabel(status: string) {
    switch (status) {
      case "VERIFIED": return t("statusLabels.verified")
      case "PENDING": return t("statusLabels.pending")
      case "FAILED": return t("statusLabels.failed")
      default: return status
    }
  }

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
        toast({ variant: "error", title: t("toast.actionFailed"), description: data.message ?? t("toast.tryAgain") })
        return
      }
      const messages = {
        approve: t("toast.approved"),
        reject: t("toast.rejected"),
        request_again: t("toast.requestedAgain"),
      }
      toast({ variant: "success", title: t("toast.done"), description: messages[action] })
      router.refresh()
    } catch {
      toast({ variant: "error", title: t("toast.networkError"), description: t("toast.unexpectedError") })
    } finally {
      setLoading(false)
    }
  }

  const confirmMeta = {
    approve: {
      title: t("confirmModals.approve.title"),
      description: t("confirmModals.approve.description"),
      confirmLabel: t("confirmModals.approve.confirm"),
      confirmClass: "bg-emerald-600 text-white hover:bg-emerald-700",
    },
    reject: {
      title: t("confirmModals.reject.title"),
      description: t("confirmModals.reject.description"),
      confirmLabel: t("confirmModals.reject.confirm"),
      confirmClass: "bg-destructive text-white hover:bg-destructive/90",
    },
    request_again: {
      title: t("confirmModals.requestAgain.title"),
      description: t("confirmModals.requestAgain.description"),
      confirmLabel: t("confirmModals.requestAgain.confirm"),
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
                {t("card.title")}
              </CardTitle>
              <CardDescription>
                {kyc.provider === "Manual" ? t("card.manualDesc") : t("card.stripeDesc")}
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
              <p className="text-xs text-muted-foreground">{t("meta.provider")}</p>
              <p className="font-medium">{kyc.provider}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("meta.submitted")}</p>
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
                <p className="text-xs text-muted-foreground">{t("meta.verifiedAt")}</p>
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
                <p className="text-xs text-muted-foreground">{t("meta.sessionId")}</p>
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
                  <span className="text-[13px] font-medium text-foreground">{t("document.submittedDoc")}</span>
                </div>
                <a
                  href={documentHref ?? documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--contrazy-teal)] hover:underline"
                >
                  <ExternalLink className="size-3" />
                  {isPdf ? t("document.download") : t("document.open")}
                </a>
              </div>

              {isPdf ? (
                <div className="flex items-center justify-center gap-2 py-6 bg-muted/10 text-sm text-muted-foreground">
                  <FileText className="size-5" />
                  {t("document.pdfDoc")} —{" "}
                  <a
                    href={documentHref ?? documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--contrazy-teal)] hover:underline"
                  >
                    {t("document.clickDownload")}
                  </a>
                </div>
              ) : isImageUrl(documentUrl) ? (
                <div className="bg-muted/10 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={documentUrl}
                    alt={t("document.altText")}
                    className="max-h-64 w-full rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-6 bg-muted/10 text-sm text-muted-foreground">
                  <ExternalLink className="size-4" />
                  <a
                    href={documentHref ?? documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--contrazy-teal)] hover:underline"
                  >
                    {t("document.viewDoc")}
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
                <p className="text-sm font-semibold text-emerald-800">{t("banners.autoVerifiedTitle")}</p>
                <p className="text-xs text-emerald-700/80">{t("banners.autoVerifiedDesc")}</p>
              </div>
            </div>
          )}

          {kyc.provider !== "Manual" && kyc.status === "FAILED" && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="size-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">{t("banners.autoFailedTitle")}</p>
                <p className="text-xs text-red-700/80">{t("banners.autoFailedDesc")}</p>
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
                {t("actions.approve")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-50"
                onClick={() => setConfirmAction("request_again")}
              >
                <RefreshCw className="mr-1.5 size-4" />
                {t("actions.requestAgain")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={() => setConfirmAction("reject")}
              >
                <XCircle className="mr-1.5 size-4" />
                {t("actions.reject")}
              </Button>
            </div>
          )}

          {isManualFailed && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <ShieldX className="size-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-800">{t("banners.manualRejected")}</p>
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
                  {t("actions.cancel")}
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
