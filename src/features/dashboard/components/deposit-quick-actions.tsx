"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Banknote, Loader2, Unlock } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
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
import { toast } from "@/components/ui/toast"

type DepositQuickActionsProps = {
  transactionId: string
  status: string
  amountCents: number
  currency: string
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

export function DepositQuickActions({
  transactionId,
  status,
  amountCents,
  currency,
}: DepositQuickActionsProps) {
  const router = useRouter()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [captureMode, setCaptureMode] = useState<"full" | "partial">("full")
  const [partialInput, setPartialInput] = useState("")
  const [pendingAction, setPendingAction] = useState<"capture" | "release" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const maxAmount = amountCents / 100
  const partialAmount = Number.parseFloat(partialInput.replace(",", "."))
  const partialValid = Number.isFinite(partialAmount) && partialAmount > 0 && partialAmount <= maxAmount

  if (status !== "AUTHORIZED") {
    return <span className="text-xs text-muted-foreground">No action</span>
  }

  async function submitDepositAction(action: "capture" | "release", captureAmount?: number) {
    setPendingAction(action)
    setError(null)

    try {
      const response = await fetch(`/api/vendor/transactions/${transactionId}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, captureAmount }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.message ?? `Unable to ${action} this deposit.`)
        return
      }

      toast({
        variant: "success",
        title: action === "capture" ? "Deposit captured" : "Deposit released",
        description:
          action === "capture"
            ? "The hold was converted into a card charge."
            : "The hold was released on the customer's card.",
      })
      setCaptureOpen(false)
      setReleaseOpen(false)
      setPartialInput("")
      setCaptureMode("full")
      router.refresh()
    } catch {
      setError(`Unable to ${action} this deposit.`)
    } finally {
      setPendingAction(null)
    }
  }

  function handleCapture() {
    if (captureMode === "partial" && !partialValid) {
      setError(`Enter an amount between ${formatMoney(1, currency)} and ${formatMoney(amountCents, currency)}.`)
      return
    }

    void submitDepositAction(
      "capture",
      captureMode === "partial" ? Math.round(partialAmount * 100) : undefined
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setError(null)
          setCaptureMode("full")
          setPartialInput("")
          setCaptureOpen(true)
        }}
      >
        <Banknote className="size-3.5" />
        Capture
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setError(null)
          setReleaseOpen(true)
        }}
      >
        <Unlock className="size-3.5" />
        Release
      </Button>

      <Dialog open={captureOpen} onOpenChange={(open) => !pendingAction && setCaptureOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="size-5 text-[var(--contrazy-teal)]" />
              Capture deposit
            </DialogTitle>
            <DialogDescription>
              Authorized amount: <strong>{formatMoney(amountCents, currency)}</strong>. Capture the full hold or enter a partial amount.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["full", "partial"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setCaptureMode(mode)
                    setError(null)
                  }}
                  className={`cursor-pointer rounded-xl border p-3 text-center text-[13px] font-semibold transition-all ${
                    captureMode === mode
                      ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]"
                      : "border-border text-muted-foreground hover:border-[var(--contrazy-teal)]/40"
                  }`}
                >
                  {mode === "full" ? "Full amount" : "Partial amount"}
                  <p className="mt-0.5 text-[12px] font-normal opacity-70">
                    {mode === "full" ? formatMoney(amountCents, currency) : "Set amount"}
                  </p>
                </button>
              ))}
            </div>

            <AnimatePresence initial={false}>
              {captureMode === "partial" ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor={`deposit-capture-${transactionId}`}>Amount to capture ({currency})</Label>
                    <Input
                      id={`deposit-capture-${transactionId}`}
                      type="number"
                      min="0.01"
                      max={maxAmount}
                      step="0.01"
                      placeholder={`e.g. ${(maxAmount / 2).toFixed(2)}`}
                      value={partialInput}
                      onChange={(event) => {
                        setPartialInput(event.target.value)
                        setError(null)
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum: {formatMoney(amountCents, currency)}
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCaptureOpen(false)}
              disabled={pendingAction === "capture"}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleCapture}
              disabled={pendingAction === "capture" || (captureMode === "partial" && !partialInput)}
              className="bg-[var(--contrazy-teal)] text-white hover:bg-[#0eb8a0]"
            >
              {pendingAction === "capture" ? <Loader2 className="size-4 animate-spin" /> : null}
              {captureMode === "partial" && partialValid
                ? `Capture ${formatMoney(Math.round(partialAmount * 100), currency)}`
                : `Capture ${formatMoney(amountCents, currency)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={releaseOpen} onOpenChange={(open) => !pendingAction && setReleaseOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="size-5 text-emerald-600" />
              Release deposit
            </DialogTitle>
            <DialogDescription>
              This releases the {formatMoney(amountCents, currency)} hold back to the customer's card.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReleaseOpen(false)}
              disabled={pendingAction === "release"}
            >
              Keep hold
            </Button>
            <Button
              type="button"
              onClick={() => submitDepositAction("release")}
              disabled={pendingAction === "release"}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {pendingAction === "release" ? <Loader2 className="size-4 animate-spin" /> : null}
              Release deposit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
