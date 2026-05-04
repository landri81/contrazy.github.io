"use client"

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import type { StripePaymentElementOptions } from "@stripe/stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, ArrowRight, CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Error Boundary ────────────────────────────────────────────────────────────

class PaymentErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean; message: string | null }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props)
    this.state = { hasError: false, message: null }
  }

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred."
    return { hasError: true, message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Payment could not be loaded</p>
              <p className="mt-1 text-xs text-destructive/80">{this.state.message}</p>
              <button
                type="button"
                className="mt-3 text-xs font-medium text-destructive underline underline-offset-2"
                onClick={() => {
                  this.setState({ hasError: false, message: null })
                  this.props.onReset()
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentConfig = {
  clientSecret: string
  stripeAccountId: string
  publishableKey: string
  financeStage: "service_payment" | "deposit_authorization"
  amountCents: number
  currency: string
  isDeposit: boolean
  title: string
  reference: string
  paymentIntentId: string
}

type LoadState = "loading" | "ready" | "confirming" | "success" | "error"

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(cents / 100)
}

// ── Inner form (must be inside <Elements>) ────────────────────────────────────

function PaymentElementInner({
  config,
  token,
  onSuccess,
}: {
  config: PaymentConfig
  token: string
  onSuccess: (nextStep: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elementReady, setElementReady] = useState(false)

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const returnUrl = `${origin}/t/${token}/payment?payment_intent=${config.paymentIntentId}&redirect_status=succeeded`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || submitting) return
    setError(null)
    setSubmitting(true)

    try {
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      })

      if (confirmError) {
        setError(confirmError.message ?? "Payment could not be completed. Please try again.")
        setSubmitting(false)
        return
      }

      // No redirect = payment confirmed synchronously (no 3DS required)
      await syncAndNavigate(config.paymentIntentId, token, onSuccess, setError, setSubmitting)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.")
      setSubmitting(false)
    }
  }

  const amountLabel = fmt(config.amountCents, config.currency)
  const isDeposit = config.isDeposit

  const paymentElementOptions: StripePaymentElementOptions = {
    layout: "tabs",
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Amount summary */}
      <div className={cn(
        "flex items-center justify-between rounded-xl border p-4",
        isDeposit
          ? "border-amber-200/60 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
          : "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex size-10 items-center justify-center rounded-full",
            isDeposit ? "bg-amber-100 dark:bg-amber-900/40" : "bg-emerald-100 dark:bg-emerald-900/40"
          )}>
            {isDeposit
              ? <Lock className="size-5 text-amber-600 dark:text-amber-400" />
              : <CreditCard className="size-5 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {isDeposit ? "Security Deposit Hold" : "Service Payment"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isDeposit ? "Card held — not charged until vendor action" : "Charged to your card now"}
            </p>
          </div>
        </div>
        <span className="text-xl font-bold text-foreground">{amountLabel}</span>
      </div>

      {/* Stripe Payment Element */}
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Card details</p>
        </div>
        <div className={cn("transition-opacity", elementReady ? "opacity-100" : "opacity-0 h-[120px]")}>
          <PaymentElement
            options={paymentElementOptions}
            onReady={() => setElementReady(true)}
          />
        </div>
        {!elementReady && (
          <div className="flex h-[120px] items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 shrink-0" />
        <span>Payments are processed securely by Stripe. Card details are never stored on our servers.</span>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="h-12 w-full bg-(--contrazy-navy) text-base font-semibold text-white hover:bg-(--contrazy-navy-soft) active:scale-[0.99] disabled:opacity-70"
        disabled={!stripe || !elements || !elementReady || submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-5 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Lock className="mr-2 size-4" />
            {isDeposit ? `Authorize ${amountLabel} Hold` : `Pay ${amountLabel} Now`}
          </>
        )}
      </Button>
    </form>
  )
}

// ── Sync helper (shared between inner form and redirect-return handler) ───────

async function syncAndNavigate(
  paymentIntentId: string,
  token: string,
  onSuccess: (nextStep: string) => void,
  setError: (msg: string | null) => void,
  setSubmitting: (v: boolean) => void
) {
  try {
    const res = await fetch(`/api/client/${token}/payment-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
    })
    const data = await res.json()

    if (res.status === 410) {
      window.location.href = `/t/${token}/cancelled`
      return
    }

    if (!res.ok || !data.success) {
      setError(data?.message ?? "Payment confirmation failed. Please contact support.")
      setSubmitting(false)
      return
    }

    onSuccess(data.nextStep ?? "complete")
  } catch {
    setError("Unable to confirm payment. Please contact support.")
    setSubmitting(false)
  }
}

// ── Main exported component ────────────────────────────────────────────────────

export function EmbeddedPaymentForm({
  token,
  amount,
  depositAmount,
}: {
  token: string
  amount: number
  depositAmount: number
  currency: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPaymentIntentId = searchParams.get("payment_intent")
  const redirectStatus = searchParams.get("redirect_status")
  const isRedirectReturn = Boolean(redirectPaymentIntentId && redirectStatus === "succeeded")

  const [loadState, setLoadState] = useState<LoadState>(isRedirectReturn ? "confirming" : "loading")
  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [successIsIntermediate, setSuccessIsIntermediate] = useState(false)
  const hasFetched = useRef(false)

  const isHybrid = amount > 0 && depositAmount > 0

  const handleSuccess = useCallback((nextStep: string) => {
    if (nextStep === "payment") {
      // Deposit done — show brief success flash then load the service payment intent
      setSuccessIsIntermediate(true)
      setLoadState("success")
      setTimeout(() => {
        setSuccessIsIntermediate(false)
        setConfig(null)
        setInitError(null)
        hasFetched.current = false
        setLoadState("loading")
        setReloadKey((k) => k + 1)
      }, 1000)
    } else {
      // Flow complete — navigate away
      setSuccessIsIntermediate(false)
      setLoadState("success")
      setTimeout(() => {
        router.push(`/t/${token}/${nextStep}`)
      }, 1200)
    }
  }, [router, token])

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    if (isRedirectReturn && redirectPaymentIntentId && reloadKey === 0) {
      // Coming back from 3DS redirect — confirm with server
      const noop = () => {}
      syncAndNavigate(redirectPaymentIntentId, token, handleSuccess, setInitError, noop).then(() => {
        if (loadState !== "success") setLoadState("ready")
      })
      return
    }

    // Fresh load (or post-deposit reload) — create next payment intent
    fetch(`/api/client/${token}/payment-intent`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.redirect) {
          router.replace(data.redirect)
          return
        }
        if (!data.success || !data.clientSecret) {
          setInitError(data.message ?? "Unable to initialize payment.")
          setLoadState("error")
          return
        }
        setConfig(data as PaymentConfig)
        setLoadState("ready")
      })
      .catch(() => {
        setInitError("Unable to initialize payment. Please refresh.")
        setLoadState("error")
      })
  }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Memoize stripe instance — only recreate when stripeAccountId changes
  const stripePromise = useMemo(() => {
    if (!config) return null
    return loadStripe(config.publishableKey, { stripeAccount: config.stripeAccountId })
  }, [config?.publishableKey, config?.stripeAccountId]) // eslint-disable-line react-hooks/exhaustive-deps

  const elementsOptions = useMemo(() => {
    if (!config) return undefined
    return {
      clientSecret: config.clientSecret,
      appearance: {
        theme: "stripe" as const,
        variables: {
          colorPrimary: "#1a3a5c",
          colorBackground: "#ffffff",
          colorText: "#0f172a",
          colorDanger: "#dc2626",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          borderRadius: "8px",
          spacingUnit: "4px",
        },
        rules: {
          ".Input": { border: "1px solid #e2e8f0", boxShadow: "none" },
          ".Input:focus": { border: "1px solid #1a3a5c", boxShadow: "0 0 0 3px rgba(26,58,92,0.12)" },
          ".Label": { fontWeight: "500", color: "#475569" },
          ".Tab": { border: "1px solid #e2e8f0" },
          ".Tab--selected": { borderColor: "#1a3a5c", color: "#1a3a5c" },
        },
      },
    }
  }, [config?.clientSecret]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loadState === "loading" || loadState === "confirming") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-5">
          <Loader2 className="size-5 animate-spin text-(--contrazy-teal)" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {loadState === "confirming" ? "Confirming your payment…" : "Preparing secure payment…"}
            </p>
            <p className="text-xs text-muted-foreground">This will only take a moment.</p>
          </div>
        </div>
        <div className="space-y-3 animate-pulse">
          <div className="h-16 rounded-xl bg-muted/50" />
          <div className="h-32 rounded-xl bg-muted/50" />
          <div className="h-12 rounded-xl bg-muted/50" />
        </div>
      </div>
    )
  }

  // ── Success flash ─────────────────────────────────────────────────────────

  if (loadState === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/20"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-base font-semibold text-emerald-800 dark:text-emerald-300">
            {successIsIntermediate ? "Deposit authorized" : "Payment confirmed"}
          </p>
          <p className="text-sm text-emerald-700/70 dark:text-emerald-400">
            {successIsIntermediate ? "Loading service payment…" : "Taking you to the next step…"}
          </p>
        </div>
      </motion.div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (loadState === "error") {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Unable to load payment</p>
            <p className="mt-1 text-xs text-destructive/80">{initError ?? "An unexpected error occurred."}</p>
            <button
              type="button"
              className="mt-3 text-xs font-medium text-destructive underline underline-offset-2"
              onClick={() => { hasFetched.current = false; setConfig(null); setInitError(null); setLoadState("loading"); setReloadKey((k) => k + 1) }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!config || !stripePromise || !elementsOptions) return null

  // ── Step indicator for hybrid flow ───────────────────────────────────────

  const currentStepLabel = config.isDeposit ? "Security Deposit" : "Service Payment"
  const stepNum = config.isDeposit ? 1 : (isHybrid ? 2 : 1)
  const totalSteps = isHybrid ? 2 : 1

  return (
    <div className="space-y-5">
      {/* Step header */}
      {isHybrid && (
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/40 px-4 py-3">
          {/* Step 1: Deposit */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
              config.isDeposit
                ? "bg-(--contrazy-navy) text-white"
                : "bg-emerald-500 text-white"
            )}>
              {config.isDeposit ? "1" : <CheckCircle2 className="size-3" />}
            </div>
            <span className={cn(
              "text-xs font-medium",
              config.isDeposit ? "text-foreground" : "text-muted-foreground line-through"
            )}>
              Deposit Hold
            </span>
          </div>
          <ArrowRight className="size-3 shrink-0 text-muted-foreground/40" />
          {/* Step 2: Service */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
              !config.isDeposit
                ? "bg-(--contrazy-navy) text-white"
                : "bg-muted text-muted-foreground"
            )}>
              2
            </div>
            <span className={cn(
              "text-xs font-medium",
              !config.isDeposit ? "text-foreground" : "text-muted-foreground"
            )}>
              Service Payment
            </span>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            Step {stepNum} of {totalSteps}
          </span>
        </div>
      )}

      {/* Payment Element form */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--contrazy-navy)/10">
            {config.isDeposit
              ? <Lock className="size-4 text-(--contrazy-navy)" />
              : <CreditCard className="size-4 text-(--contrazy-navy)" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{currentStepLabel}</p>
            <p className="text-xs text-muted-foreground">
              {config.title} · {config.reference}
            </p>
          </div>
          <span className="ml-auto text-lg font-bold text-foreground">
            {fmt(config.amountCents, config.currency)}
          </span>
        </div>

        <div className="p-4 sm:p-5">
          <PaymentErrorBoundary onReset={() => { hasFetched.current = false; setConfig(null); setInitError(null); setLoadState("loading"); setReloadKey((k) => k + 1) }}>
            <Elements stripe={stripePromise} options={elementsOptions}>
              <PaymentElementInner
                config={config}
                token={token}
                onSuccess={handleSuccess}
              />
            </Elements>
          </PaymentErrorBoundary>
        </div>
      </div>

      {/* Powered by Stripe */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
        <svg viewBox="0 0 60 25" className="h-4 w-auto fill-current opacity-50" xmlns="http://www.w3.org/2000/svg">
          <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.07zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.1h-3.13v5.85zm-4.91.7c0 2.97-2.31 4.66-5.73 4.66a11.2 11.2 0 0 1-4.46-.93v-3.93c1.38.75 3.1 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.26 13.77 0 14.51 0 9.95 0 7.04 2.28 5.3 5.62 5.3c1.5 0 3.01.23 4.51.9v3.86C8.76 9.4 7.15 9 5.62 9c-.89 0-1.42.23-1.42.96 0 1.38 6.41.98 6.41 6.88z"/>
        </svg>
        <span>Payments secured by Stripe</span>
      </div>
    </div>
  )
}
