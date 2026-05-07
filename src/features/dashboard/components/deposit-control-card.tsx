"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Flag,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  XCircle,
} from "lucide-react"
import { useState } from "react"
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
import { INPUT_LIMITS, MIN_DISPUTE_SUMMARY_LENGTH } from "@/lib/validation/input-limits"

type PendingAction = "capture" | "release" | "dispute" | "cancel" | null

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

export function DepositControlCard({
  transactionId,
  depositStatus,
  transactionStatus,
  amount,
  currency,
}: {
  transactionId: string
  depositStatus: string
  transactionStatus?: string
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

  const maxEuros = amount / 100

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

    if (captureMode === "partial") {
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
        toast({
          variant: "success",
          title: t("toast.captured"),
          description: t("toast.capturedDesc", {
            amount: captureAmountCents ? fmt(captureAmountCents, currency) : fmt(amount, currency),
          }),
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
        toast({ variant: "success", title: t("toast.released"), description: t("toast.releasedDesc") })
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

  async function handleDispute() {
    setDisputeError(null)
    if (disputeSummary.trim().length < MIN_DISPUTE_SUMMARY_LENGTH) {
      setDisputeError(t("disputeModal.minChars", { min: MIN_DISPUTE_SUMMARY_LENGTH }))
      return
    }
    setPendingAction("dispute")
    try {
      const { ok, data } = await callApi("dispute", { summary: disputeSummary.trim() })
      if (ok) {
        setDisputeOpen(false)
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
        toast({ variant: "info", title: t("toast.cancelled"), description: t("toast.cancelledDesc") })
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
            <p className="text-sm text-amber-700 dark:text-amber-400">{t("statuses.disputeDesc")}</p>
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
            <p className="text-sm text-amber-700 dark:text-amber-400">{t("statuses.capturedDesc")}</p>
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
            <p className="text-sm text-muted-foreground">{t("statuses.cancelledDesc")}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Active / AUTHORIZED state ────────────────────────────────────────────────

  if (depositStatus !== "AUTHORIZED") return null

  const partialEuros = parseFloat(partialInput.replace(",", "."))
  const partialValid = !isNaN(partialEuros) && partialEuros > 0 && partialEuros <= maxEuros
  const partialAmountCents = partialValid ? Math.round(partialEuros * 100) : null
  const partialCaptureWarning =
    partialAmountCents !== null && partialAmountCents < amount
      ? {
          captureAmountCents: partialAmountCents,
          releaseAmountCents: amount - partialAmountCents,
        }
      : null
  const captureLabel =
    captureMode === "partial" && partialAmountCents !== null
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
          <CardDescription>{t("card.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">

            {/* Capture */}
            <ActionButton
              icon={<Banknote className="size-4" />}
              iconBg="bg-(--contrazy-teal)/10 text-(--contrazy-teal)"
              iconHoverBg="group-hover:bg-(--contrazy-teal)/20"
              borderHover="hover:border-(--contrazy-teal)/40"
              label={t("actions.capture")}
              sublabel={t("actions.captureDetail")}
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
              label={t("actions.release")}
              sublabel={t("actions.releaseDetail")}
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
              {t("captureModal.title")}
            </DialogTitle>
            <DialogDescription>
              {t("captureModal.description", { amount: fmt(amount, currency) })}
            </DialogDescription>
          </DialogHeader>

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

            {captureError && (
              <p className="text-[13px] text-destructive">{captureError}</p>
            )}
          </div>

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
              disabled={pendingAction === "capture" || (captureMode === "partial" && !partialInput)}
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
        onOpenChange={(open: boolean) => { if (!pendingAction) setDisputeOpen(open) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              {t("disputeModal.title")}
            </DialogTitle>
            <DialogDescription>{t("disputeModal.description")}</DialogDescription>
          </DialogHeader>

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
            {disputeError && (
              <p className="text-[13px] text-destructive">{disputeError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisputeOpen(false)}
              disabled={pendingAction === "dispute"}
            >
              {t("disputeModal.cancel")}
            </Button>
            <Button
              onClick={handleDispute}
              disabled={pendingAction === "dispute"}
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
