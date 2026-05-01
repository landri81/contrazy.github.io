"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck, ShieldAlert, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function DepositControlCard({ 
  transactionId, 
  depositStatus, 
  amount, 
  currency 
}: { 
  transactionId: string
  depositStatus: string
  amount: number
  currency: string
}) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(cents / 100)
  }

  async function handleAction(action: "release" | "capture") {
    if (action === "capture") {
      if (!confirm(`Are you sure you want to capture the ${formatCurrency(amount)} deposit? This cannot be undone and will charge the client's card.`)) {
        return
      }
    } else {
      if (!confirm(`Are you sure you want to release the ${formatCurrency(amount)} deposit hold?`)) {
        return
      }
    }

    setIsPending(true)
    setError(null)

    try {
      const res = await fetch(`/api/vendor/transactions/${transactionId}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      })

      const data = await res.json()

      if (res.ok) {
        router.refresh()
      } else {
        setError(data.message || "Failed to process action")
      }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setIsPending(false)
    }
  }

  if (depositStatus === "RELEASED") {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10">
        <CardContent className="pt-6 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-300">Deposit Released</p>
            <p className="text-sm text-green-700 dark:text-green-400">The {formatCurrency(amount)} hold was released successfully.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (depositStatus === "CAPTURED") {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-900/10">
        <CardContent className="pt-6 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-900 dark:text-yellow-300">Deposit Captured</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">The {formatCurrency(amount)} hold was captured as a charge.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (depositStatus === "AUTHORIZED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Active Deposit Hold
          </CardTitle>
          <CardDescription>
            {formatCurrency(amount)} is currently held on the client&apos;s card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <p className="text-sm text-muted-foreground">
            You can release the hold if the transaction is completed without issues, or capture it if a claim is needed. Holds expire automatically after 7 days if no action is taken.
          </p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" className="w-full" onClick={() => handleAction("release")} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Release Hold"}
          </Button>
          <Button variant="destructive" className="w-full" onClick={() => handleAction("capture")} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Capture Deposit"}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return null
}
