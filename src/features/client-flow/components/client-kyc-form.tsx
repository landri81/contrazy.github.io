"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ClientKycForm({ token }: { token: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify() {
    setIsPending(true)
    setError(null)

    try {
      const res = await fetch(`/api/client/${token}/kyc`, { method: "POST" })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.message || "Failed to initialize verification")
        setIsPending(false)
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
      setIsPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Verify Identity
        </CardTitle>
        <CardDescription>
          You will be redirected to our secure partner (Stripe Identity) to verify your government ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <p className="text-sm text-muted-foreground">
          Make sure you have your driver&apos;s license, passport, or national ID card ready. The process usually takes less than a minute.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleVerify} className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Start Verification
        </Button>
      </CardFooter>
    </Card>
  )
}
