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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"

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
        setCaptureError("Enter a valid amount greater than 0.")
        return
      }
      if (val > maxEuros) {
        setCaptureError(`The amount cannot exceed ${fmt(amount, currency)}.`)
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
          title: "Deposit captured",
          description: `${captureAmountCents ? fmt(captureAmountCents, currency) : fmt(amount, currency)} was charged successfully.`,
        })
        router.refresh()
      } else {
        setCaptureError(data.message ?? "Capture failed.")
      }
    } catch {
      setCaptureError("An unexpected error occurred.")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleRelease() {
    setPendingAction("release")
    try {
      const { ok, data } = await callApi("deposit", { action: "release" })
      if (ok) {
        toast({ variant: "success", title: "Deposit released", description: "The hold was released on the customer's card." })
        router.refresh()
      } else {
        toast({ variant: "error", title: "Failed", description: data.message ?? "Unable to release the deposit." })
      }
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
    } finally {
      setPendingAction(null)
    }
  }

  async function handleDispute() {
    setDisputeError(null)
    if (disputeSummary.trim().length < 10) {
      setDisputeError("Describe the dispute reason using at least 10 characters.")
      return
    }
    setPendingAction("dispute")
    try {
      const { ok, data } = await callApi("dispute", { summary: disputeSummary.trim() })
      if (ok) {
        setDisputeOpen(false)
        toast({ variant: "warning", title: "Dispute opened", description: "The transaction is now marked as disputed." })
        router.refresh()
      } else {
        setDisputeError(data.message ?? "Unable to open the dispute.")
      }
    } catch {
      setDisputeError("An unexpected error occurred.")
    } finally {
      setPendingAction(null)
    }
  }

  async function handleCancel() {
    setPendingAction("cancel")
    try {
      const { ok, data } = await callApi("cancel", {})
      if (ok) {
        toast({ variant: "info", title: "Transaction cancelled", description: "The deposit hold was released automatically." })
        router.refresh()
      } else {
        toast({ variant: "error", title: "Failed", description: data.message ?? "Unable to cancel." })
      }
    } catch {
      toast({ variant: "error", title: "Network error", description: "An unexpected error occurred." })
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
            <p className="font-semibold text-amber-900 dark:text-amber-300">Dispute in progress</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              The deposit hold is frozen while the platform reviews the dispute. Capture and release are disabled until a decision is made.
            </p>
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
            <p className="font-semibold text-emerald-900 dark:text-emerald-300">Deposit released</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">{fmt(amount, currency)} returned to the customer.</p>
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
            <p className="font-semibold text-amber-900 dark:text-amber-300">Deposit captured</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">The hold was converted into a card charge.</p>
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
            <p className="font-semibold text-foreground">Deposit cancelled</p>
            <p className="text-sm text-muted-foreground">The transaction was cancelled and the hold was released.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Active / AUTHORIZED state ────────────────────────────────────────────────

  if (depositStatus !== "AUTHORIZED") return null

  const partialEuros = parseFloat(partialInput.replace(",", "."))
  const partialValid = !isNaN(partialEuros) && partialEuros > 0 && partialEuros <= maxEuros
  const captureLabel =
    captureMode === "partial" && partialValid
      ? `Capture ${fmt(Math.round(partialEuros * 100), currency)}`
      : `Capture ${fmt(amount, currency)}`

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-5 text-(--contrazy-teal)" />
            Active deposit - {fmt(amount, currency)}
          </CardTitle>
          <CardDescription>
            The amount is held on the customer's card. Choose the next action for this transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">

            {/* Capture */}
            <ActionButton
              icon={<Banknote className="size-4" />}
              iconBg="bg-(--contrazy-teal)/10 text-(--contrazy-teal)"
              iconHoverBg="group-hover:bg-(--contrazy-teal)/20"
              borderHover="hover:border-(--contrazy-teal)/40"
              label="Capture deposit"
              sublabel="Charge all or part of the amount"
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
              label="Release deposit"
              sublabel="Return the hold to the customer"
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
              label="Open dispute"
              sublabel="Report an issue on this transaction"
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
              label="Cancel transaction"
              sublabel="Automatically releases the deposit"
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
              Capture deposit
            </DialogTitle>
            <DialogDescription>
              Authorized amount: <strong>{fmt(amount, currency)}</strong>. Choose the amount to charge.
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
                  {mode === "full" ? "Full amount" : "Partial amount"}
                  <p className="mt-0.5 text-[12px] font-normal opacity-70">
                    {mode === "full" ? fmt(amount, currency) : "Set amount"}
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
                    <Label htmlFor="capture-amount">Amount to capture ({currency})</Label>
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
                      Maximum: {fmt(amount, currency)}
                    </p>
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
              Cancel
            </Button>
            <Button
              onClick={handleCapture}
              disabled={pendingAction === "capture" || (captureMode === "partial" && !partialInput)}
              className="bg-(--contrazy-teal) text-white hover:bg-[#0eb8a0]"
            >
              {pendingAction === "capture" ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />Capturing...</>
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
              Open dispute
            </DialogTitle>
            <DialogDescription>
              Describe the dispute reason. The transaction will be marked as disputed and the deposit
              will remain held during resolution.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="dispute-summary">Dispute reason</Label>
            <Textarea
              id="dispute-summary"
              rows={4}
              placeholder="Example: returned item has unreported damage..."
              value={disputeSummary}
              onChange={(e) => { setDisputeSummary(e.target.value); setDisputeError(null) }}
            />
            <p className="text-[12px] text-muted-foreground">
              {disputeSummary.trim().length} / 10 characters minimum
            </p>
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
              Cancel
            </Button>
            <Button
              onClick={handleDispute}
              disabled={pendingAction === "dispute"}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {pendingAction === "dispute" ? (
                <><Loader2 className="mr-2 size-4 animate-spin" />Opening...</>
              ) : "Open dispute"}
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
