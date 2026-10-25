"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js"
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

type SavedCard = { paymentMethodId: string; brand: string | null; last4: string | null }
type IntentConfig = { clientSecret: string; stripeAccountId: string; publishableKey: string; savedCard?: SavedCard | null; setupIntentId?: string }
type ApiResult = { success?: boolean; message?: string; status?: string } & Partial<IntentConfig>

async function post(url: string, body?: unknown): Promise<ApiResult> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    const data = (await response.json().catch(() => null)) as ApiResult | null
    return response.ok && data ? data : { success: false, message: data?.message }
  } catch {
    return { success: false }
  }
}

function Problem({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  )
}

function Done({ title, text }: { title: string; text: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <CheckCircle2 className="size-9 text-emerald-600" />
      <p className="text-base font-semibold text-emerald-800">{title}</p>
      <p className="text-sm text-emerald-800/80">{text}</p>
    </div>
  )
}

function PaymentStep({ token, config, amountLabel, returnUrl, onDone }: { token: string; config: IntentConfig; amountLabel: string; returnUrl: string; onDone: () => void }) {
  const t = useTranslations("chargeLink")
  const stripe = useStripe()
  const elements = useElements()
  const [otherCard, setOtherCard] = useState(!config.savedCard)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish(stripeError?: { message?: string } | null) {
    if (stripeError) {
      setError(stripeError.message ?? t("payFailed"))
      setBusy(false)
      return
    }

    const result = await post(`/api/pay/${token}/confirm`)

    if (!result.success) {
      setError(result.message ?? t("payFailed"))
      setBusy(false)
      return
    }

    onDone()
  }

  async function paySaved(stripeJs: StripeJs) {
    setBusy(true)
    setError(null)
    const { error: stripeError } = await stripeJs.confirmCardPayment(config.clientSecret, { payment_method: config.savedCard!.paymentMethodId })
    await finish(stripeError)
  }

  async function payOther(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    const { error: stripeError } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" })
    await finish(stripeError)
  }

  return (
    <div className="space-y-4">
      {config.savedCard && !otherCard ? (
        <div className="space-y-3">
          <Button
            type="button"
            className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft)"
            disabled={!stripe || busy}
            onClick={() => stripe && void paySaved(stripe)}
          >
            {busy ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Lock className="mr-2 size-4" />}
            {t("paySaved", { amount: amountLabel, last4: config.savedCard.last4 ?? "····" })}
          </Button>
          <button type="button" className="w-full text-sm font-medium text-muted-foreground underline underline-offset-2" onClick={() => setOtherCard(true)}>
            {t("useAnotherCard")}
          </button>
        </div>
      ) : (
        <form onSubmit={payOther} className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{t("cardDetails")}</p>
            </div>
            <PaymentElement options={{ layout: "tabs" }} />
          </div>
          <Button type="submit" className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft)" disabled={!stripe || !elements || busy}>
            {busy ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Lock className="mr-2 size-4" />}
            {t("pay", { amount: amountLabel })}
          </Button>
        </form>
      )}
      {error ? <Problem message={error} /> : null}
    </div>
  )
}

function CardUpdateStep({ token, config, returnUrl, onDone }: { token: string; config: IntentConfig; returnUrl: string; onDone: (charged: boolean, message?: string) => void }) {
  const t = useTranslations("chargeLink")
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    const { error: stripeError } = await stripe.confirmSetup({ elements, confirmParams: { return_url: returnUrl }, redirect: "if_required" })

    if (stripeError) {
      setError(stripeError.message ?? t("saveFailed"))
      setBusy(false)
      return
    }

    const result = await post(`/api/pay/${token}/card-updated`, { setupIntentId: config.setupIntentId })

    if (!result.success) {
      setError(result.message ?? t("saveFailed"))
      setBusy(false)
      return
    }

    onDone(result.status === "succeeded", result.message ?? undefined)
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t("newCard")}</p>
        </div>
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      <Button type="submit" className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft)" disabled={!stripe || !elements || busy}>
        {busy ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Lock className="mr-2 size-4" />}
        {t("saveAndPay")}
      </Button>
      {error ? <Problem message={error} /> : null}
    </form>
  )
}

/**
 * Customer page of a declined post-rental charge (Spec v2.1 §9-§10): pay the
 * same charge on session (3D Secure if asked), or, for an expired or wrong
 * card, agree again to the card terms and give a new card, charged at once.
 */
export function ChargePayForm({
  token,
  mode,
  amountLabel,
  consent,
}: {
  token: string
  mode: "payment" | "card_update"
  amountLabel: string
  consent: { fr: string; en: string; showTranslation: boolean } | null
}) {
  const t = useTranslations("chargeLink")
  const locale = normalizeLocale(useLocale())
  const searchParams = useSearchParams()
  const [config, setConfig] = useState<IntentConfig | null>(null)
  const returning = Boolean(searchParams.get("redirect_status"))
  const [state, setState] = useState<"consent" | "loading" | "ready" | "paid" | "declined" | "error">(mode === "card_update" && !returning ? "consent" : "loading")
  const [message, setMessage] = useState<string | null>(null)
  const [ticked, setTicked] = useState(false)
  const started = useRef(false)
  const returnUrl = typeof window !== "undefined" ? `${window.location.origin}${withLocalePath(locale, `/pay/${token}`)}` : ""

  useEffect(() => {
    if (started.current) return
    started.current = true

    // Back from a 3D Secure redirect.
    if (returning) {
      const setupIntent = searchParams.get("setup_intent")
      void (setupIntent ? post(`/api/pay/${token}/card-updated`, { setupIntentId: setupIntent }) : post(`/api/pay/${token}/confirm`)).then((result) => {
        if (result.success && (result.status === "succeeded" || !setupIntent)) setState("paid")
        else {
          setMessage(result.message ?? t("payFailed"))
          setState(result.success ? "declined" : "error")
        }
      })
      return
    }

    if (mode === "payment") {
      void post(`/api/pay/${token}/intent`).then((result) => {
        if (result.success && result.clientSecret && result.stripeAccountId && result.publishableKey) {
          setConfig(result as IntentConfig)
          setState("ready")
        } else {
          setMessage(result.message ?? t("loadFailed"))
          setState("error")
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stripePromise = useMemo(
    () => (config ? loadStripe(config.publishableKey, { stripeAccount: config.stripeAccountId }) : null),
    [config?.publishableKey, config?.stripeAccountId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  async function acceptAndContinue() {
    setState("loading")
    const result = await post(`/api/pay/${token}/card-setup`, { accepted: true })

    if (result.success && result.clientSecret && result.stripeAccountId && result.publishableKey) {
      setConfig(result as IntentConfig)
      setState("ready")
    } else {
      setMessage(result.message ?? t("loadFailed"))
      setState("error")
    }
  }

  if (state === "paid") return <Done title={t("paidTitle")} text={t("paidText")} />
  if (state === "declined") return <Problem message={message ?? t("newCardDeclined")} />
  if (state === "error") return <Problem message={message ?? t("loadFailed")} />

  if (state === "consent" && consent) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("cardUpdateIntro")}</p>
        <blockquote lang="fr" className="rounded-xl border border-border/60 bg-muted/40 p-3.5 text-sm leading-relaxed text-foreground">
          {consent.fr}
        </blockquote>
        {consent.showTranslation ? (
          <p lang="en" className="text-sm leading-relaxed text-muted-foreground">
            {consent.en}
          </p>
        ) : null}
        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3.5">
          <Checkbox id="charge-consent" checked={ticked} onCheckedChange={(checked: boolean) => setTicked(checked)} />
          <Label htmlFor="charge-consent" className="cursor-pointer text-sm font-medium leading-snug">
            {t("consentCheckbox")}
          </Label>
        </div>
        <Button type="button" className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft)" disabled={!ticked} onClick={() => void acceptAndContinue()}>
          {t("consentContinue")}
        </Button>
      </div>
    )
  }

  if (state === "loading" || !config || !stripePromise) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-5">
        <Loader2 className="size-5 animate-spin text-(--contrazy-teal)" />
        <p className="text-sm font-medium text-foreground">{t("preparing")}</p>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: config.clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#1a3a5c", borderRadius: "8px" } } }}>
      {mode === "payment" ? (
        <PaymentStep token={token} config={config} amountLabel={amountLabel} returnUrl={returnUrl} onDone={() => setState("paid")} />
      ) : (
        <CardUpdateStep
          token={token}
          config={config}
          returnUrl={returnUrl}
          onDone={(charged, declineMessage) => {
            if (charged) setState("paid")
            else {
              setMessage(declineMessage ?? null)
              setState("declined")
            }
          }}
        />
      )}
    </Elements>
  )
}
