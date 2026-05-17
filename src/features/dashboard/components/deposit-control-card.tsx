"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  ImageIcon,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import {
  type DisputeEvidenceAsset,
  MAX_DISPUTE_EVIDENCE_FILES,
  uploadDisputeEvidence,
  validateDisputeEvidenceFile,
} from "@/features/dashboard/lib/dispute-evidence-upload-client"
import { INPUT_LIMITS, MIN_DISPUTE_SUMMARY_LENGTH } from "@/lib/validation/input-limits"

type PendingAction = "capture" | "release" | "dispute" | "cancel" | null

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

export function DepositControlCard({
  transactionId,
  depositStatus,
  transactionStatus,
  depositStrategy,
  depositAutoRefundAt,
  amount,
  currency,
}: {
  transactionId: string
  depositStatus: string
  transactionStatus?: string
  depositStrategy?: string | null
  depositAutoRefundAt?: Date | string | null
  amount: number
  currency: string
}) {
  const router = useRouter()
  const t = useTranslations("dashboard.vendor.depositControl")
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureMode, setCaptureMode] = useState<"full" | "partial">("full")
  const [partialInput, setPartialInput] = useState("")
  const [captureError, setCaptureError] = useState<string | null>(null)

  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeSummary, setDisputeSummary] = useState("")
  const [disputeError, setDisputeError] = useState<string | null>(null)
  const [evidenceFiles, setEvidenceFiles] = useState<DisputeEvidenceAsset[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]) // file names currently uploading
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxEuros = amount / 100
  const isChargeRefund = depositStrategy === "CHARGE_REFUND"

  const autoRefundDate = depositAutoRefundAt
    ? new Date(depositAutoRefundAt).toLocaleDateString("en-US", { dateStyle: "medium" })
    : null

  async function callApi(path: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/vendor/transactions/${transactionId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return { ok: res.ok, data: await res.json() }
  }

  async function handleCapture() {
    setCaptureError(null)
    let captureAmountCents: number | undefined

    if (!isChargeRefund && captureMode === "partial") {
      const val = parseFloat(partialInput.replace(",", "."))
      if (isNaN(val) || val <= 0) {
        setCaptureError(t("errors.invalidAmount"))
        return
      }
      if (val > maxEuros) {
        setCaptureError(t("errors.exceedsMax", { max: fmt(amount, currency) }))
        return
      }
      captureAmountCents = Math.round(val * 100)
    }

    setPendingAction("capture")
    try {
      const { ok, data } = await callApi("deposit", {
        action: "capture",
        captureAmount: captureAmountCents,
      })
      if (ok) {
        setCaptureOpen(false)
        const displayAmount = captureAmountCents ? fmt(captureAmountCents, currency) : fmt(amount, currency)
        toast({
          variant: "success",
          title: t("toast.captured"),
          description: isChargeRefund
            ? t("toast.capturedDescChargeRefund", { amount: displayAmount })
            : t("toast.capturedDesc", { amount: displayAmount }),
        })
        router.refresh()
      } else {
        setCaptureError(data.message ?? t("toast.unexpectedError"))
      }
    } catch {
      setCaptureError(t("toast.unexpectedError"))
    } finally {
      setPendingAction(null)
    }
  }

  async function handleRelease() {
    setPendingAction("release")
    try {
      const { ok, data } = await callApi("deposit", { action: "release" })
      if (ok) {
        toast({ variant: "success", title: t("toast.released"), description: isChargeRefund ? t("toast.releasedDescChargeRefund") : t("toast.releasedDesc") })
        router.refresh()
      } else {
        toast({ variant: "error", title: t("toast.failed"), description: data.message ?? t("toast.unexpectedError") })
      }
    } catch {
      toast({ variant: "error", title: t("toast.networkError"), description: t("toast.unexpectedError") })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleEvidenceFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (!files.length) return

    const remaining = MAX_DISPUTE_EVIDENCE_FILES - evidenceFiles.length
    const toUpload = files.slice(0, remaining)

    for (const file of toUpload) {
      const err = validateDisputeEvidenceFile(file)
      if (err) {
        setDisputeError(err.message)
        return
      }
    }

    setUploadingFiles((prev) => [...prev, ...toUpload.map((f) => f.name)])
    setDisputeError(null)

    const results = await Promise.allSettled(
      toUpload.map((file) => uploadDisputeEvidence(file, transactionId))
    )

    const uploaded: DisputeEvidenceAsset[] = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === "fulfilled") {
        uploaded.push(result.value)
      } else {
        setDisputeError((result.reason as Error).message ?? `Failed to upload "${toUpload[i].name}"`)
      }
    }

    setEvidenceFiles((prev) => [...prev, ...uploaded])
    setUploadingFiles((prev) => prev.filter((n) => !toUpload.map((f) => f.name).includes(n)))
  }

  function removeEvidenceFile(publicId: string) {
    setEvidenceFiles((prev) => prev.filter((f) => f.publicId !== publicId))
  }

  async function handleDispute() {
    setDisputeError(null)
    if (disputeSummary.trim().length < MIN_DISPUTE_SUMMARY_LENGTH) {
      setDisputeError(t("disputeModal.minChars", { min: MIN_DISPUTE_SUMMARY_LENGTH }))
      return
    }
    if (uploadingFiles.length > 0) {
      setDisputeError("Please wait for all files to finish uploading.")
      return
    }
    setPendingAction("dispute")
    try {
      const res = await fetch(`/api/vendor/transactions/${transactionId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: disputeSummary.trim(),
          evidenceImages: evidenceFiles,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setDisputeOpen(false)
        setEvidenceFiles([])
        setDisputeSummary("")
        toast({ variant: "warning", title: t("toast.disputeOpened"), description: t("toast.disputeOpenedDesc") })
        router.refresh()
      } else {
        setDisputeError(data.message ?? t("toast.unexpectedError"))
      }
    } catch {
      setDisputeError(t("toast.unexpectedError"))
    } finally {
      setPendingAction(null)
    }
  }

  async function handleCancel() {
    setPendingAction("cancel")
    try {
      const { ok, data } = await callApi("cancel", {})
      if (ok) {
        toast({ variant: "info", title: t("toast.cancelled"), description: isChargeRefund ? t("toast.cancelledDescChargeRefund") : t("toast.cancelledDesc") })
        router.refresh()
      } else {
        toast({ variant: "error", title: t("toast.failed"), description: data.message ?? t("toast.unexpectedError") })
      }
    } catch {
      toast({ variant: "error", title: t("toast.networkError"), description: t("toast.unexpectedError") })
    } finally {
      setPendingAction(null)
    }
  }

  // ── Terminal states ──────────────────────────────────────────────────────────

  if (transactionStatus === "DISPUTED") {
    return (
      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-900/10">
        <CardContent className="flex items-center gap-3 pt-6">
          <Flag className="size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-300">{t("statuses.disputeTitle")}</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">{isChargeRefund ? t("statuses.disputeDescChargeRefund") : t("statuses.disputeDesc")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (depositStatus === "RELEASED") {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-900/10">
        <CardContent className="flex items-center gap-3 pt-6">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-900 dark:text-emerald-300">{t("statuses.releasedTitle")}</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("statuses.releasedDesc", { amount: fmt(amount, currency) })}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (depositStatus === "CAPTURED") {
    return (
      <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-900/10">
        <CardContent className="flex items-center gap-3 pt-6">
          <ShieldAlert className="size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-300">{t("statuses.capturedTitle")}</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">{isChargeRefund ? t("statuses.capturedDescChargeRefund") : t("statuses.capturedDesc")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (depositStatus === "CANCELLED") {
    return (
      <Card className="border-border bg-muted/30">
        <CardContent className="flex items-center gap-3 pt-6">
          <XCircle className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">{t("statuses.cancelledTitle")}</p>
            <p className="text-sm text-muted-foreground">{isChargeRefund ? t("statuses.cancelledDescChargeRefund") : t("statuses.cancelledDesc")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Active state: AUTHORIZED (auth-hold) or SUCCEEDED (charge-refund) ────────

  const isActive = depositStatus === "AUTHORIZED" || depositStatus === "SUCCEEDED"
  if (!isActive) return null

  const partialEuros = parseFloat(partialInput.replace(",", "."))
  const partialValid = !isNaN(partialEuros) && partialEuros > 0 && partialEuros <= maxEuros
  const partialAmountCents = partialValid ? Math.round(partialEuros * 100) : null
  const partialCaptureWarning =
    !isChargeRefund && partialAmountCents !== null && partialAmountCents < amount
      ? {
          captureAmountCents: partialAmountCents,
          releaseAmountCents: amount - partialAmountCents,
        }
      : null
  const captureLabel =
    isChargeRefund
      ? t("actions.captureChargeRefund")
      : captureMode === "partial" && partialAmountCents !== null
        ? `${t("captureModal.title")} ${fmt(partialAmountCents, currency)}`
        : `${t("captureModal.title")} ${fmt(amount, currency)}`

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-5 text-(--contrazy-teal)" />
            {t("card.title")} - {fmt(amount, currency)}
          </CardTitle>
          <CardDescription>
            {isChargeRefund ? t("card.descriptionChargeRefund") : t("card.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CHARGE_REFUND info banner */}
          {isChargeRefund && autoRefundDate && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
              <Clock className="mt-0.5 size-4 shrink-0" />
              <span>{t("chargeRefundBanner.autoRefundOn", { date: autoRefundDate })}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">

            {/* Capture */}
            <ActionButton
              icon={<Banknote className="size-4" />}
              iconBg="bg-(--contrazy-teal)/10 text-(--contrazy-teal)"
              iconHoverBg="group-hover:bg-(--contrazy-teal)/20"
              borderHover="hover:border-(--contrazy-teal)/40"
              label={isChargeRefund ? t("actions.captureChargeRefund") : t("actions.capture")}
              sublabel={isChargeRefund ? t("actions.captureChargeRefundDetail") : t("actions.captureDetail")}
              loading={pendingAction === "capture"}
              disabled={!!pendingAction}
              onClick={() => {
                setCaptureMode("full")
                setPartialInput("")
                setCaptureError(null)
                setCaptureOpen(true)
              }}
            />

            {/* Release */}
            <ActionButton
              icon={<Unlock className="size-4" />}
              iconBg="bg-emerald-500/10 text-emerald-600"
              iconHoverBg="group-hover:bg-emerald-500/20"
              borderHover="hover:border-emerald-300"
              label={isChargeRefund ? t("actions.releaseChargeRefund") : t("actions.release")}
              sublabel={isChargeRefund ? t("actions.releaseChargeRefundDetail") : t("actions.releaseDetail")}
              loading={pendingAction === "release"}
              disabled={!!pendingAction}
              onClick={handleRelease}
            />

            {/* Dispute */}
            <ActionButton
              icon={<Flag className="size-4" />}
              iconBg="bg-amber-500/10 text-amber-600"
              iconHoverBg="group-hover:bg-amber-500/20"
              borderHover="hover:border-amber-300"
              label={t("actions.dispute")}
              sublabel={t("actions.disputeDetail")}
              loading={pendingAction === "dispute"}
              disabled={!!pendingAction}
              onClick={() => {
                setDisputeSummary("")
                setDisputeError(null)
                setDisputeOpen(true)
              }}
            />

            {/* Cancel */}
            <ActionButton
              icon={<XCircle className="size-4" />}
              iconBg="bg-red-500/10 text-red-600"
              iconHoverBg="group-hover:bg-red-500/20"
              borderHover="hover:border-red-300"
              label={t("actions.cancel")}
              sublabel={t("actions.cancelDetail")}
              loading={pendingAction === "cancel"}
              disabled={!!pendingAction}
              onClick={handleCancel}
            />

          </div>
        </CardContent>
      </Card>

      {/* ── Capture Modal ──────────────────────────────────────────────────── */}
      <Dialog
        open={captureOpen}
        onOpenChange={(open: boolean) => { if (!pendingAction) setCaptureOpen(open) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="size-5 text-(--contrazy-teal)" />
              {isChargeRefund ? t("actions.captureChargeRefund") : t("captureModal.title")}
            </DialogTitle>
            <DialogDescription>
              {isChargeRefund
                ? t("captureModal.descriptionChargeRefund", { amount: fmt(amount, currency) })
                : t("captureModal.description", { amount: fmt(amount, currency) })}
            </DialogDescription>
          </DialogHeader>

          {!isChargeRefund && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["full", "partial"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setCaptureMode(mode); setCaptureError(null) }}
                    className={`cursor-pointer rounded-xl border p-3 text-center text-[13px] font-semibold transition-all ${
                      captureMode === mode
                        ? "border-(--contrazy-teal) bg-(--contrazy-teal)/10 text-(--contrazy-teal)"
                        : "border-border text-muted-foreground hover:border-(--contrazy-teal)/40"
                    }`}
                  >
                    {mode === "full" ? t("captureModal.fullAmount") : t("captureModal.partialAmount")}
                    <p className="mt-0.5 text-[12px] font-normal opacity-70">
                      {mode === "full" ? fmt(amount, currency) : t("captureModal.setAmount")}
                    </p>
                  </button>
                ))}
              </div>

              <AnimatePresence initial={false}>
                {captureMode === "partial" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="capture-amount">{t("captureModal.amountLabel", { currency })}</Label>
                      <div className="relative">
                        <Input
                          id="capture-amount"
                          type="number"
                          min="0.01"
                          max={maxEuros}
                          step="0.01"
                          placeholder={`e.g. ${(maxEuros / 2).toFixed(2)}`}
                          value={partialInput}
                          onChange={(e) => { setPartialInput(e.target.value); setCaptureError(null) }}
                          className="pr-14"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted-foreground">
                          {currency}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        {t("captureModal.maximum", { amount: fmt(amount, currency) })}
                      </p>
                      {partialCaptureWarning ? (
                        <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                          <AlertTriangle className="size-4" />
                          <AlertTitle>{t("captureModal.warningTitle")}</AlertTitle>
                          <AlertDescription className="text-amber-800 dark:text-amber-200">
                            {t("captureModal.warningDesc", {
                              captureAmount: fmt(partialCaptureWarning.captureAmountCents, currency),
                              releaseAmount: fmt(partialCaptureWarning.releaseAmountCents, currency),
                            })}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {captureError && (
            <p className="text-[13px] text-destructive">{captureError}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCaptureOpen(false)}
              disabled={pendingAction === "capture"}
            >
              {t("captureModal.cancel")}
            </Button>
            <Button
              onClick={handleCapture}
              disabled={pendingAction === "capture" || (!isChargeRefund && captureMode === "partial" && !partialInput)}
              className="bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]"
            >
              {pendingAction === "capture" ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />{t("captureModal.capturing")}</>
              ) : captureLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dispute Modal ──────────────────────────────────────────────────── */}
      <Dialog
        open={disputeOpen}
        onOpenChange={(open: boolean) => {
          if (!pendingAction && uploadingFiles.length === 0) {
            setDisputeOpen(open)
            if (!open) { setEvidenceFiles([]); setDisputeSummary(""); setDisputeError(null) }
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              {t("disputeModal.title")}
            </DialogTitle>
            <DialogDescription>{isChargeRefund ? t("disputeModal.descriptionChargeRefund") : t("disputeModal.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="space-y-2">
              <Label htmlFor="dispute-summary">{t("disputeModal.reasonLabel")}</Label>
              <Textarea
                id="dispute-summary"
                rows={4}
                placeholder={t("disputeModal.placeholder")}
                maxLength={INPUT_LIMITS.disputeSummary}
                value={disputeSummary}
                onChange={(e) => { setDisputeSummary(e.target.value); setDisputeError(null) }}
              />
              <div className="flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
                <span>{t("disputeModal.minChars", { min: MIN_DISPUTE_SUMMARY_LENGTH })}</span>
                <CharacterCount current={disputeSummary.length} limit={INPUT_LIMITS.disputeSummary} />
              </div>
            </div>

            {/* Evidence upload */}
            <div className="space-y-2">
              <Label>{t("disputeModal.evidenceLabel")}</Label>
              <p className="text-[12px] text-muted-foreground">{t("disputeModal.evidenceHint")}</p>

              {/* Upload trigger */}
              {evidenceFiles.length < MAX_DISPUTE_EVIDENCE_FILES && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="hidden"
                    onChange={handleEvidenceFileSelect}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles.length > 0 || pendingAction === "dispute"}
                    className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-5 text-center transition-colors hover:border-(--contrazy-teal)/50 hover:bg-(--contrazy-teal)/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UploadCloud className="size-6 text-muted-foreground" />
                    <span className="text-[13px] font-medium text-foreground">{t("disputeModal.uploadCta")}</span>
                    <span className="text-[11px] text-muted-foreground">JPG, PNG, WebP, GIF, PDF · max 10 MB each · up to {MAX_DISPUTE_EVIDENCE_FILES} files</span>
                  </button>
                </>
              )}

              {/* Uploading spinners */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-1">
                  {uploadingFiles.map((name) => (
                    <div key={name} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[13px]">
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                      <span className="truncate text-muted-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Uploaded files preview */}
              {evidenceFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {evidenceFiles.map((file) => {
                    const isPdf = file.fileName.toLowerCase().endsWith(".pdf") || file.assetUrl.includes("/raw/")
                    return (
                      <div key={file.publicId} className="group relative overflow-hidden rounded-lg border border-border bg-muted/30">
                        {isPdf ? (
                          <div className="flex h-20 flex-col items-center justify-center gap-1 px-2">
                            <FileText className="size-7 text-muted-foreground" />
                            <span className="line-clamp-2 text-center text-[10px] text-muted-foreground leading-tight">{file.fileName}</span>
                          </div>
                        ) : (
                          <img
                            src={file.assetUrl}
                            alt={file.fileName}
                            className="h-20 w-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeEvidenceFile(file.publicId)}
                          className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X className="size-3.5 text-foreground" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {evidenceFiles.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {evidenceFiles.length} / {MAX_DISPUTE_EVIDENCE_FILES} {t("disputeModal.filesAdded")}
                </p>
              )}
            </div>

            {disputeError && (
              <p className="text-[13px] text-destructive">{disputeError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDisputeOpen(false); setEvidenceFiles([]); setDisputeSummary(""); setDisputeError(null) }}
              disabled={pendingAction === "dispute" || uploadingFiles.length > 0}
            >
              {t("disputeModal.cancel")}
            </Button>
            <Button
              onClick={handleDispute}
              disabled={pendingAction === "dispute" || uploadingFiles.length > 0}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {pendingAction === "dispute" ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />{t("disputeModal.opening")}</>
              ) : t("disputeModal.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ActionButton({
  icon,
  iconBg,
  iconHoverBg,
  borderHover,
  label,
  sublabel,
  loading,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  iconBg: string
  iconHoverBg: string
  borderHover: string
  label: string
  sublabel: string
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background p-4 text-left transition-all ${borderHover} hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${iconBg} ${iconHoverBg}`}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-foreground">{label}</p>
        <p className="text-[12px] text-muted-foreground">{sublabel}</p>
      </div>
    </button>
  )
}
