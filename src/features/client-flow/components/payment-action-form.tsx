"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

export function PaymentActionForm({
  token,
  amount,
  depositAmount,
  currency,
  nextStage,
  pendingConfirmation,
}: {
  token: string
  amount: number
  depositAmount: number
  currency: string
  nextStage: "service_payment" | "deposit_authorization"
  pendingConfirmation?: boolean
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function fmt(cents: number) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100)
  }

  async function handleCheckout() {
    setIsPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/client/${token}/checkout`, { method: "POST" })
      const data = await res.json()
      if (res.status === 410) { router.replace(`/t/${token}/cancelled`); return }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data?.message ?? "Unable to start checkout right now.")
      }
    } catch {
      setError("Unable to start checkout right now.")
    } finally {
      setIsPending(false)
    }
  }

  const isDepositStep = nextStage === "deposit_authorization"
  const isHybrid = amount > 0 && depositAmount > 0

  const ctaLabel = isDepositStep ? "Authorize Deposit Hold" : "Pay Service Amount"

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardContent className="space-y-4 pt-5">
        {/* Pending stripe confirmation */}
        {pendingConfirmation && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
            <p>Confirming your previous step — this page will refresh automatically.</p>
          </div>
        )}

        {/* Error */}
        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step indicator for hybrid */}
        {isHybrid && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <div className={`flex size-5 items-center justify-center rounded-full text-xs font-bold ${isDepositStep ? "bg-(--contrazy-navy) text-white" : "bg-muted text-muted-foreground"}`}>
              1
            </div>
            <span className={`text-xs font-medium ${isDepositStep ? "text-foreground" : "text-muted-foreground line-through"}`}>
              Deposit Hold
            </span>
            <span className="text-muted-foreground/40">→</span>
            <div className={`flex size-5 items-center justify-center rounded-full text-xs font-bold ${!isDepositStep ? "bg-(--contrazy-navy) text-white" : "bg-muted text-muted-foreground"}`}>
              2
            </div>
            <span className={`text-xs font-medium ${!isDepositStep ? "text-foreground" : "text-muted-foreground"}`}>
              Service Payment
            </span>
          </div>
        )}

        <div className="space-y-3">
          {/* Deposit Hold — always shown first when present */}
          {depositAmount > 0 && (
            <div className={`rounded-xl border p-4 transition-all ${isDepositStep ? "border-(--contrazy-navy)/30 bg-(--contrazy-navy)/5 ring-1 ring-(--contrazy-navy)/20" : "border-border/60 bg-muted/20 opacity-60"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Lock className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Security Deposit</p>
                    <p className="text-xs text-muted-foreground">Card hold — not charged</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-foreground">{fmt(depositAmount)}</span>
              </div>
              {isDepositStep && (
                <p className="mt-3 text-xs text-muted-foreground border-t border-border/40 pt-3">
                  Your card will be <strong>held</strong> for {fmt(depositAmount)} — this is not a charge. The hold will be released or converted into a charge by the vendor after the transaction is complete.
                </p>
              )}
            </div>
          )}

          {/* Service Payment — shown second */}
          {amount > 0 && (
            <div className={`rounded-xl border p-4 transition-all ${!isDepositStep ? "border-(--contrazy-navy)/30 bg-(--contrazy-navy)/5 ring-1 ring-(--contrazy-navy)/20" : "border-border/60 bg-muted/20 opacity-60"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <CreditCard className="size-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Service Payment</p>
                    <p className="text-xs text-muted-foreground">Charged immediately</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-foreground">{fmt(amount)}</span>
              </div>
              {!isDepositStep && (
                <p className="mt-3 text-xs text-muted-foreground border-t border-border/40 pt-3">
                  {fmt(amount)} will be <strong>charged</strong> to your card now and transferred to the vendor.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-lg border border-border/60 bg-muted/20 divide-y divide-border/40">
          {depositAmount > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Deposit hold (not charged)</span>
              <span className="font-medium text-foreground">{fmt(depositAmount)}</span>
            </div>
          )}
          {amount > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Service payment (charged)</span>
              <span className="font-medium text-foreground">{fmt(amount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold">
            <span className="text-foreground">
              {isDepositStep ? "Amount to authorize now" : "Amount to pay now"}
            </span>
            <span className="text-lg text-foreground">
              {isDepositStep ? fmt(depositAmount) : fmt(amount)}
            </span>
          </div>
        </div>

        {/* Shield note */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" />
          <span>Payments are processed securely via Stripe. Your card details are never stored.</span>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          onClick={handleCheckout}
          className="w-full bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
          disabled={isPending || pendingConfirmation}
        >
          {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {isPending ? "Redirecting to Stripe…" : ctaLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
