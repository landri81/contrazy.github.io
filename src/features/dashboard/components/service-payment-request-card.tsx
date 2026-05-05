"use client"

import { useState } from "react"
import { Loader2, SendHorizonal } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function formatMoney(amount: number | null, currency: string) {
  if (!amount) {
    return "N/A"
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount / 100)
}

export function ServicePaymentRequestCard({
  transactionId,
  amount,
  currency,
  customerCompletedAt,
  servicePaymentRequestedAt,
  paymentAlreadyCollected,
}: {
  transactionId: string
  amount: number | null
  currency: string
  customerCompletedAt: string | null
  servicePaymentRequestedAt: string | null
  paymentAlreadyCollected: boolean
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRequest = Boolean(amount && customerCompletedAt && !servicePaymentRequestedAt && !paymentAlreadyCollected)

  async function handleRequest() {
    setIsPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/vendor/transactions/${transactionId}/service-payment-request`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        setError(payload?.message ?? "Unable to request service payment right now.")
        return
      }

      router.refresh()
    } catch (requestError) {
      console.error(requestError)
      setError("Unable to request service payment right now.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deferred service payment</CardTitle>
        <CardDescription>
          Use the same secure link later when the service payment should be collected after delivery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4 text-sm">
          <p className="font-medium text-foreground">Amount</p>
          <p className="mt-1 text-muted-foreground">{formatMoney(amount, currency)}</p>
          <p className="mt-3 font-medium text-foreground">Client onboarding</p>
          <p className="mt-1 text-muted-foreground">
            {customerCompletedAt
              ? `Completed on ${new Date(customerCompletedAt).toLocaleString()}.`
              : "The client must finish the initial profile, documents, agreement, and any deposit step first."}
          </p>
          <p className="mt-3 font-medium text-foreground">Request status</p>
          <p className="mt-1 text-muted-foreground">
            {paymentAlreadyCollected
              ? "Service payment already collected."
              : servicePaymentRequestedAt
                ? `Requested on ${new Date(servicePaymentRequestedAt).toLocaleString()}.`
                : "Not requested yet."}
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="button" onClick={handleRequest} disabled={!canRequest || isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendHorizonal className="mr-2 h-4 w-4" />}
          Request service payment
        </Button>
      </CardContent>
    </Card>
  )
}
