"use client"

import { useState } from "react"
import { Loader2, CreditCard, ShieldCheck } from "lucide-react"

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
  const [isPending, setIsPending] = useState(false)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(cents / 100)
  }

  async function handleCheckout() {
    setIsPending(true)

    try {
      const res = await fetch(`/api/client/${token}/checkout`, { method: "POST" })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsPending(false)
    }
  }

  const ctaLabel =
    nextStage === "service_payment"
      ? amount > 0 && depositAmount > 0
        ? "Pay Service Amount"
        : "Proceed to Payment"
      : "Authorize Deposit Hold"

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {pendingConfirmation ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            We are confirming your previous Stripe step. This page will refresh automatically once the transaction is updated.
          </div>
        ) : null}
        <div className="space-y-4">
          {amount > 0 && (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-full">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium">Service Payment</h4>
                  <p className="text-xs text-muted-foreground">Due now</p>
                </div>
              </div>
              <span className="font-bold text-lg">{formatCurrency(amount)}</span>
            </div>
          )}

          {depositAmount > 0 && (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500/10 p-2 rounded-full">
                  <ShieldCheck className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-medium">Security Deposit</h4>
                  <p className="text-xs text-muted-foreground">Authorized hold</p>
                </div>
              </div>
              <span className="font-bold text-lg">{formatCurrency(depositAmount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between p-4 border-t border-b mt-2">
            <span className="font-semibold text-lg">Total</span>
            <span className="font-bold text-2xl">{formatCurrency(amount + depositAmount)}</span>
          </div>

          {depositAmount > 0 && (
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
              <strong>Note about deposits:</strong> The security deposit amount will be temporarily held on your card, not charged. It will be released automatically according to the transaction terms unless a claim is filed.
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleCheckout} className="w-full" disabled={isPending || pendingConfirmation}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {ctaLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
