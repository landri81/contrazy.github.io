"use client"

import { useState } from "react"
import { AlertCircle, ExternalLink, Loader2, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { useSubmissionLock } from "@/features/client-flow/hooks/use-submission-lock"

export function ClientStripeIdentityForm({
  token,
  failed,
  currentStatus,
  nextStep,
}: {
  token: string
  failed?: boolean
  currentStatus?: string | null
  nextStep: string
}) {
  const t = useTranslations("clientFlow.stripeIdentity")
  const router = useRouter()
  const submission = useSubmissionLock()
  const [isContinuing, setIsContinuing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasPendingVerification = currentStatus === "PENDING"
  const hasVerifiedIdentity = currentStatus === "VERIFIED"
  const hasExistingVerification = hasPendingVerification || hasVerifiedIdentity
  const ctaLabel = hasExistingVerification ? t("restartBtn") : t("startBtn")

  function handleContinue() {
    if (isContinuing || submission.isLocked) return
    setIsContinuing(true)
    router.push(`/t/${token}/${nextStep}`)
  }

  async function handleStart() {
    submission.start()
    setError(null)
    try {
      const res = await fetch(`/api/client/${token}/kyc/start-stripe-identity`, { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.message ?? t("startError"))
        return
      }
      submission.keepLocked()
      window.location.href = data.url
    } catch {
      setError(t("unexpectedError"))
    } finally {
      submission.finish()
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
            <p className="font-semibold text-foreground">{t("title")}</p>
            <p className="text-sm text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-2">
        {failed && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{t("failedNotice")}</p>
          </div>
        )}

        {hasPendingVerification ? (
          <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/20 dark:text-sky-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" />
            <p>{t("pendingNotice")}</p>
          </div>
        ) : null}

        {hasVerifiedIdentity ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <p>{t("verifiedNotice")}</p>
          </div>
        ) : null}

        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-foreground">{t("whatToExpect")}</p>
          <ul className="space-y-1">
            {[t("step1"), t("step2"), t("step3"), t("step4")].map((step) => (
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
          {t("secureNote")}
        </p>
      </CardContent>

      <CardFooter className="px-5 pb-5 pt-3">
        {hasExistingVerification ? (
          <div className="grid w-full gap-2 sm:grid-cols-2">
            <Button
              type="button"
              className="bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
              disabled={submission.isLocked || isContinuing}
              onClick={handleContinue}
            >
              {isContinuing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {isContinuing ? t("continuing") : t("continueBtn")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-border/70 bg-background"
              disabled={submission.isLocked || isContinuing}
              onClick={handleStart}
            >
              {submission.isLocked ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 size-4" />
              )}
              {submission.isLocked ? t("starting") : ctaLabel}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="w-full bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
            disabled={submission.isLocked || isContinuing}
            onClick={handleStart}
          >
            {submission.isLocked ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 size-4" />
            )}
            {submission.isLocked ? t("starting") : ctaLabel}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
