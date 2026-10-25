"use client"

import { useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

/**
 * Consent to later charges on the saved card (Spec v2.1 §6), before any card
 * form. The French clause is binding and always shown; the English
 * translation is shown alongside for other customers. The box starts
 * unticked, and the card form (children) only mounts once the server has
 * logged the consent, so no intent is ever created without it.
 */
export function CardConsentGate({
  token,
  consentGiven,
  textFr,
  textEn,
  showTranslation,
  children,
}: {
  token: string
  consentGiven: boolean
  textFr: string
  textEn: string
  showTranslation: boolean
  children: ReactNode
}) {
  const t = useTranslations("clientFlow.cardSecurity")
  const [accepted, setAccepted] = useState(consentGiven)
  const [ticked, setTicked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (accepted) {
    return <>{children}</>
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!ticked || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/client/${token}/card-security/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      })
      const data = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null

      if (!response.ok || !data?.success) {
        setError(data?.message ?? t("consentError"))
        return
      }

      setAccepted(true)
    } catch {
      setError(t("consentError"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--contrazy-teal)/10">
            <ShieldCheck className="size-5 text-(--contrazy-teal)" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{t("consentTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("consentIntro")}</p>
          </div>
        </div>

        <blockquote lang="fr" className="mt-4 rounded-xl border border-border/60 bg-muted/40 p-3.5 text-sm leading-relaxed text-foreground">
          {textFr}
        </blockquote>

        {showTranslation ? (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("translationLabel")}</p>
            <p lang="en" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {textEn}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3.5">
          <Checkbox id="card-consent" checked={ticked} onCheckedChange={(checked: boolean) => setTicked(checked)} />
          <Label htmlFor="card-consent" className="cursor-pointer text-sm font-medium leading-snug">
            {t("consentCheckbox")}
          </Label>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Button
        type="submit"
        className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft) active:scale-[0.99] disabled:opacity-60"
        disabled={!ticked || submitting}
      >
        {submitting ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
        {t("consentContinue")}
      </Button>
    </form>
  )
}
