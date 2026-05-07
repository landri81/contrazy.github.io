"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2, CreditCard, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import type { VendorProfile } from "@prisma/client"

export function StripeConnectCard({ profile }: { profile: VendorProfile | null | undefined }) {
  const t = useTranslations("dashboard.vendor.stripeConnect")
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
        setError(data.message || t("notConnected.hint"))
        setIsLoading(false)
      }
    } catch {
      setError(t("notConnected.hint"))
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isConnected ? (
          <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle>{t("connected.title")}</AlertTitle>
            <AlertDescription>{t("connected.description")}</AlertDescription>
          </Alert>
        ) : isPending ? (
          <div className="space-y-4">
            <Alert className="border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertTitle>{t("pending.title")}</AlertTitle>
              <AlertDescription>{t("pending.description")}</AlertDescription>
            </Alert>
            <Button onClick={handleConnect} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("pending.button")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {!isApproved ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                <AlertTitle>{t("notConnected.approvalTitle")}</AlertTitle>
                <AlertDescription>{t("notConnected.approvalDesc")}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">{t("notConnected.hint")}</p>
            )}
            <Button onClick={handleConnect} disabled={isLoading || !isApproved} className="w-full sm:w-auto">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("notConnected.button")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
