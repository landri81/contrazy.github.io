"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useRouter } from "@/i18n/navigation"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"
import { cn } from "@/lib/utils"

type SetupConfig = { clientSecret: string; setupIntentId: string; stripeAccountId: string; publishableKey: string }
type ConfirmResult = { ok: true; nextStep: string } | { ok: false; message: string }

async function confirmOnServer(token: string, setupIntentId: string, fallback: string): Promise<ConfirmResult> {
  try {
    const response = await fetch(`/api/client/${token}/card-security/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupIntentId }),
    })
    const data = (await response.json().catch(() => null)) as { success?: boolean; nextStep?: string; message?: string } | null

    if (!response.ok || !data?.success) {
      return { ok: false, message: data?.message ?? fallback }
    }

    return { ok: true, nextStep: data.nextStep ?? "complete" }
  } catch {
    return { ok: false, message: fallback }
  }
}

function SetupFormInner({ config, token, returnUrl, onSaved }: { config: SetupConfig; token: string; returnUrl: string; onSaved: (nextStep: string) => void }) {
  const t = useTranslations("clientFlow.cardSecurity")
  const stripe = useStripe()
  const elements = useElements()
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError(null)

    const { error: setupError } = await stripe.confirmSetup({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" })

    if (setupError) {
      // Stripe's message is written for the cardholder (e.g. "Your card has expired.").
      setError(setupError.message ?? t("saveFailed"))
      setSubmitting(false)
      return
    }

    const result = await confirmOnServer(token, config.setupIntentId, t("saveFailed"))

    if (!result.ok) {
      setError(result.message)
      setSubmitting(false)
      return
    }

    onSaved(result.nextStep)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-(--contrazy-teal)" />
        <p className="text-sm text-muted-foreground">{t("noChargeNow")}</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t("cardDetails")}</p>
        </div>
        <div className={cn("transition-opacity", ready ? "opacity-100" : "h-[120px] opacity-0")}>
          <PaymentElement options={{ layout: "tabs" }} onReady={() => setReady(true)} />
        </div>
        {!ready ? (
          <div className="flex h-[120px] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
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
        className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft) active:scale-[0.99] disabled:opacity-70"
        disabled={!stripe || !elements || !ready || submitting}
      >
        {submitting ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Lock className="mr-2 size-4" />}
        {submitting ? t("saving") : t("saveCard")}
      </Button>
    </form>
  )
}

/** "Card as security only" (Spec v2.1 §4): saves the card with a SetupIntent, nothing is charged now. */
export function CardSecurityForm({ token }: { token: string }) {
  const t = useTranslations("clientFlow.cardSecurity")
  const locale = normalizeLocale(useLocale())
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnedIntentId = searchParams.get("setup_intent")
  const returnedFromRedirect = Boolean(returnedIntentId && searchParams.get("redirect_status"))
  const [config, setConfig] = useState<SetupConfig | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "saved" | "error">("loading")
  const [message, setMessage] = useState<string | null>(null)
  const started = useRef(false)

  function goNext(nextStep: string) {
    setState("saved")
    setTimeout(() => router.push(`/t/${token}/${nextStep}`), 1000)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true

    // Back from a 3DS redirect: the server reads the SetupIntent at Stripe.
    if (returnedFromRedirect && returnedIntentId) {
      void confirmOnServer(token, returnedIntentId, t("saveFailed")).then((result) => {
        if (result.ok) {
          goNext(result.nextStep)
        } else {
          setMessage(result.message)
          setState("error")
        }
      })
      return
    }

    fetch(`/api/client/${token}/card-security/setup-intent`, { method: "POST" })
      .then((response) => response.json())
      .then((data: { success?: boolean; redirect?: string; message?: string } & Partial<SetupConfig>) => {
        if (data.redirect) {
          window.location.assign(data.redirect)
          return
        }

        if (!data.success || !data.clientSecret || !data.setupIntentId || !data.stripeAccountId || !data.publishableKey) {
          setMessage(data.message ?? t("loadFailed"))
          setState("error")
          return
        }

        setConfig({ clientSecret: data.clientSecret, setupIntentId: data.setupIntentId, stripeAccountId: data.stripeAccountId, publishableKey: data.publishableKey })
        setState("ready")
      })
      .catch(() => {
        setMessage(t("loadFailed"))
        setState("error")
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stripePromise = useMemo(
    () => (config ? loadStripe(config.publishableKey, { stripeAccount: config.stripeAccountId }) : null),
    [config?.publishableKey, config?.stripeAccountId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const returnUrl = typeof window !== "undefined" ? `${window.location.origin}${withLocalePath(locale, `/t/${token}/payment`)}?stage=card` : ""

  if (state === "saved") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center"
      >
        <CheckCircle2 className="size-8 text-emerald-600" />
        <p className="text-base font-semibold text-emerald-800">{t("saved")}</p>
      </motion.div>
    )
  }

  if (state === "error") {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div>
          <p>{message}</p>
          <button type="button" className="mt-2 font-medium underline underline-offset-2" onClick={() => window.location.assign(withLocalePath(locale, `/t/${token}/payment?stage=card`))}>
            {t("tryAgain")}
          </button>
        </div>
      </div>
    )
  }

  if (state === "loading" || !config || !stripePromise) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-5" role="status">
        <Loader2 className="size-5 animate-spin text-(--contrazy-teal)" />
        <p className="text-sm font-medium text-foreground">{returnedFromRedirect ? t("confirming") : t("preparing")}</p>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: config.clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#1a3a5c", borderRadius: "8px" } } }}>
      <SetupFormInner config={config} token={token} returnUrl={returnUrl} onSaved={goNext} />
    </Elements>
  )
}
