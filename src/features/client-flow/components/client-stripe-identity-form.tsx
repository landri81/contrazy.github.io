"use client"

import { useState } from "react"
import { AlertCircle, ExternalLink, Loader2, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

export function ClientStripeIdentityForm({
  token,
  failed,
}: {
  token: string
  failed?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/client/${token}/kyc/start-stripe-identity`, { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.message ?? "Could not start verification. Please try again.")
        return
      }
      window.location.href = data.url
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--contrazy-navy)/10">
            <ShieldCheck className="size-5 text-(--contrazy-navy)" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Identity Verification</p>
            <p className="text-sm text-muted-foreground">
              Powered by Stripe Identity — secure and automated.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-2">
        {failed && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>Your previous verification was not completed. Please try again.</p>
          </div>
        )}

        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-foreground">What to expect</p>
          <ul className="space-y-1">
            {[
              "You will be redirected to a secure Stripe page",
              "Take a photo of your government-issued ID",
              "A quick selfie for liveness check",
              "Results are returned automatically",
            ].map((step) => (
              <li key={step} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1 rounded-full bg-muted-foreground/60 shrink-0" />
                {step}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Your data is processed securely by Stripe and shared only with the requesting party.
        </p>
      </CardContent>

      <CardFooter className="px-5 pb-5 pt-3">
        <Button
          type="button"
          className="w-full bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
          disabled={loading}
          onClick={handleStart}
        >
          {loading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 size-4" />
          )}
          {loading ? "Starting…" : "Verify with Stripe"}
        </Button>
      </CardFooter>
    </Card>
  )
}
