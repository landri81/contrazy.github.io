"use client"

import { useState } from "react"
import { ClipboardCheck, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function RequestCheckoutCard({
  transactionId,
  checkInSubmittedAt,
  checkOutRequestedAt,
  checkOutSubmittedAt,
}: {
  transactionId: string
  checkInSubmittedAt: string | null
  checkOutRequestedAt: string | null
  checkOutSubmittedAt: string | null
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRequest = Boolean(checkInSubmittedAt && !checkOutRequestedAt && !checkOutSubmittedAt)

  async function handleRequest() {
    setIsPending(true)
    setError(null)

    try {
      const res = await fetch(`/api/vendor/transactions/${transactionId}/request-checkout`, {
        method: "POST",
      })
      const payload = await res.json().catch(() => null)

      if (!res.ok || !payload?.success) {
        setError(payload?.message ?? "Failed to request checkout. Please try again.")
        return
      }

      router.refresh()
    } catch {
      setError("Failed to request checkout. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check-In / Check-Out</CardTitle>
        <CardDescription>
          Track the service lifecycle. Request checkout once the service period is ending.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-3">
          <div>
            <p className="font-medium text-foreground">Check-In</p>
            <p className="mt-1 text-muted-foreground">
              {checkInSubmittedAt
                ? `Submitted on ${new Date(checkInSubmittedAt).toLocaleString()}`
                : "Pending — customer has not completed check-in yet."}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Checkout Request</p>
            <p className="mt-1 text-muted-foreground">
              {checkOutSubmittedAt
                ? `Check-out submitted on ${new Date(checkOutSubmittedAt).toLocaleString()}`
                : checkOutRequestedAt
                  ? `Requested on ${new Date(checkOutRequestedAt).toLocaleString()} — awaiting customer.`
                  : "Not requested yet."}
            </p>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          type="button"
          onClick={handleRequest}
          disabled={!canRequest || isPending}
          variant="outline"
        >
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ClipboardCheck className="mr-2 size-4" />
          )}
          Request checkout
        </Button>
      </CardContent>
    </Card>
  )
}
