"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2, CreditCard, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import type { VendorProfile } from "@prisma/client"

export function StripeConnectCard({ profile }: { profile: VendorProfile | null | undefined }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConnected = profile?.stripeConnectionStatus === "CONNECTED"
  const isPending = profile?.stripeConnectionStatus === "PENDING"
  const isApproved = profile?.reviewStatus === "APPROVED"

  async function handleConnect() {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/vendor/stripe/connect", {
        method: "POST",
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.message || "Failed to initialize Stripe connection")
        setIsLoading(false)
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Stripe Account
        </CardTitle>
        <CardDescription>
          Connect your Stripe account to process payments and handle deposit holds securely.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isConnected ? (
          <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle>Connected</AlertTitle>
            <AlertDescription>
              Your Stripe account is successfully connected and ready to process transactions.
            </AlertDescription>
          </Alert>
        ) : isPending ? (
          <div className="space-y-4">
            <Alert className="border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertTitle>Information Needed</AlertTitle>
              <AlertDescription>
                You started connecting your Stripe account, but some information is still missing. Please resume onboarding.
              </AlertDescription>
            </Alert>
            <Button onClick={handleConnect} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resume Stripe Onboarding
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!isApproved ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                <AlertTitle>Approval required</AlertTitle>
                <AlertDescription>
                  Finish your business profile review before connecting Stripe for live customer flows.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                You must connect a Stripe account before you can create transactions with payment or deposit requirements.
              </p>
            )}
            <Button onClick={handleConnect} disabled={isLoading || !isApproved} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect with Stripe
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
