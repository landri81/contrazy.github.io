"use client"

import { useState } from "react"
import { ClipboardCheck, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"

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
  const locale = useLocale()
  const t = useTranslations("dashboard.vendor.transactionDetailPage")
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canRequest = Boolean(checkInSubmittedAt && !checkOutRequestedAt && !checkOutSubmittedAt)

  const intlLocale = locale === "fr" ? "fr-FR" : "en-GB"

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString(intlLocale)
  }

  async function handleRequest() {
    setIsPending(true)
    setError(null)

    try {
      const res = await fetch(`/api/vendor/transactions/${transactionId}/request-checkout`, {
        method: "POST",
      })
      const payload = await res.json().catch(() => null)

      if (!res.ok || !payload?.success) {
        setError(payload?.message ?? t("requestCheckoutError"))
        return
      }

      router.refresh()
    } catch {
      setError(t("requestCheckoutError"))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("checkInOutTitle")}</CardTitle>
        <CardDescription>
          {t("checkInOutDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-3">
          <div>
            <p className="font-medium text-foreground">{t("checkInLabel")}</p>
            <p className="mt-1 text-muted-foreground">
              {checkInSubmittedAt
                ? t("submittedOn", { date: formatDateTime(checkInSubmittedAt) })
                : t("checkInPending")}
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">{t("checkoutRequestLabel")}</p>
            <p className="mt-1 text-muted-foreground">
              {checkOutSubmittedAt
                ? t("checkOutSubmittedOn", { date: formatDateTime(checkOutSubmittedAt) })
                : checkOutRequestedAt
                  ? t("requestedOnAwaitingCustomer", { date: formatDateTime(checkOutRequestedAt) })
                  : t("notRequestedYet")}
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
          {t("requestCheckoutButton")}
        </Button>
      </CardContent>
    </Card>
  )
}
