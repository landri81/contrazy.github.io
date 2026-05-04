"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ConnectAccountManagement,
  ConnectBalances,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayments,
  ConnectPayouts,
} from "@stripe/react-connect-js"
import { loadConnectAndInitialize } from "@stripe/connect-js"
import { AlertCircle, BarChart3, CreditCard, Loader2, ReceiptText, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Tab = "balances" | "account" | "payments" | "payouts"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "balances", label: "Overview", icon: BarChart3 },
  { id: "account", label: "Account", icon: CreditCard },
  { id: "payments", label: "Payments", icon: ReceiptText },
  { id: "payouts", label: "Payouts", icon: Wallet },
]

type AccountSessionSuccess = {
  clientSecret: string
  message?: string
}

type AccountSessionError = {
  status: number
  code?: string
  message: string
  redirectTo?: string
}

type LoadStage = "session" | "dashboard"

async function fetchAccountSession(): Promise<
  { ok: true; data: AccountSessionSuccess } | { ok: false; error: AccountSessionError }
> {
  const res = await fetch("/api/vendor/stripe/account-session", { method: "POST" })
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        code: data?.code,
        message: data?.message ?? "Failed to create account session.",
        redirectTo: data?.redirectTo,
      },
    }
  }

  return {
    ok: true,
    data: {
      clientSecret: data?.clientSecret,
      message: data?.message,
    },
  }
}

function resolvePageBackground(): string {
  try {
    const tmp = document.createElement("div")
    tmp.style.cssText = "position:absolute;visibility:hidden;background:var(--card,var(--background,#ffffff))"
    document.body.appendChild(tmp)
    const rgb = getComputedStyle(tmp).backgroundColor
    document.body.removeChild(tmp)
    const m = rgb.match(/\d+/g)
    if (m && m.length >= 3) {
      const h = (n: string) => parseInt(n).toString(16).padStart(2, "0")
      return `#${h(m[0])}${h(m[1])}${h(m[2])}`
    }
  } catch {}
  return "#ffffff"
}

export function StripeEmbeddedDashboard({ publishableKey }: { publishableKey: string }) {
  const router = useRouter()
  const [stripeInstance, setStripeInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("balances")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<AccountSessionError | null>(null)
  const [loadStage, setLoadStage] = useState<LoadStage>("session")
  const [loadDetail, setLoadDetail] = useState("Verifying your workspace access and preparing a secure Stripe session.")
  const [pageBg, setPageBg] = useState("#ffffff")

  const initialize = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setSessionError(null)
    setStripeInstance(null)
    setLoadStage("session")
    setLoadDetail("Verifying your workspace access and preparing a secure Stripe session.")
    try {
      const bg = resolvePageBackground()
      setPageBg(bg)
      const sessionResult = await fetchAccountSession()

      if (!sessionResult.ok) {
        setSessionError(sessionResult.error)
        return
      }

      setLoadStage("dashboard")
      setLoadDetail(sessionResult.data.message ?? "Stripe session created. Loading balances, payouts, and account tools.")

      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => sessionResult.data.clientSecret,
        appearance: {
          overlays: "dialog",
          variables: {
            colorPrimary: "#13c2aa",
            colorBackground: bg,
            borderRadius: "8px",
            fontFamily: "inherit",
            spacingUnit: "10px",
          },
        },
      })
      setStripeInstance(instance)
    } catch {
      setError("Failed to initialize Stripe dashboard. Please refresh the page.")
    } finally {
      setIsLoading(false)
    }
  }, [publishableKey])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void initialize()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [initialize])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,1))] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] ring-1 ring-[var(--contrazy-teal)]/12">
            <Loader2 className="size-4 animate-spin" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {loadStage === "session" ? "Preparing session" : "Loading dashboard"}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {loadStage === "session" ? "Connecting to Stripe securely" : "Initializing embedded workspace"}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {loadDetail}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
            <div className="space-y-2">
              {[
                { label: "Create account session", active: loadStage === "session", done: loadStage === "dashboard" },
                { label: "Load embedded Stripe tools", active: loadStage === "dashboard", done: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      item.done
                        ? "bg-(--contrazy-navy) text-white"
                        : item.active
                          ? "bg-[var(--contrazy-teal)] text-slate-950"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.done ? "✓" : item.active ? "…" : "·"}
                  </div>
                  <span className={cn("text-sm", item.active || item.done ? "text-foreground" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {["Balances and activity", "Account tasks", "Payments", "Payouts"].map((label) => (
              <div key={label} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="h-3 w-24 rounded-full bg-muted" />
                <div className="mt-3 h-14 rounded-xl bg-muted/70" />
                <div className="mt-2 h-3 w-32 rounded-full bg-muted/70" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (sessionError || error || !stripeInstance) {
    const isSubscriptionIssue = sessionError?.status === 402 || sessionError?.code === "SUBSCRIPTION_REQUIRED"
    const isMissingAccount = sessionError?.code === "NO_STRIPE_ACCOUNT"
    const title = isSubscriptionIssue
      ? "Subscription required"
      : isMissingAccount
        ? "Stripe account not available"
        : error ?? "Something went wrong"
    const description = sessionError?.message ?? "The Stripe dashboard could not be loaded."

    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50/30 p-8 text-center dark:border-red-900 dark:bg-red-950/20">
        <AlertCircle className="size-6 text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">{title}</p>
          <p className="mt-1 text-xs text-red-600/80 dark:text-red-400">{description}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {sessionError?.redirectTo ? (
              <Button
                type="button"
                variant="outline"
                className="border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-400"
                onClick={() => {
                  window.location.href = sessionError.redirectTo!
                }}
              >
                Open billing
              </Button>
            ) : isMissingAccount ? (
              <Button
                type="button"
                variant="outline"
                className="border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-400"
                onClick={() => {
                  router.refresh()
                }}
              >
                Refresh status
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-400"
              onClick={initialize}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeInstance}>
      <div className="space-y-3">
        {/* Notification banner — auto-hides when no alerts, shows inline when there are */}
        <div className="[&>*]:!rounded-xl [&>*]:!border [&>*]:!border-amber-200">
          <ConnectNotificationBanner />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all sm:text-sm",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <tab.icon className="size-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Stripe panel — background matches the resolved page bg so there's no seam */}
        <div className="rounded-2xl border border-border shadow-sm" style={{ backgroundColor: pageBg }}>
          <div className={activeTab === "balances" ? "block" : "hidden"}>
            <ConnectBalances />
          </div>
          <div className={activeTab === "account" ? "block" : "hidden"}>
            <ConnectAccountManagement />
          </div>
          <div className={activeTab === "payments" ? "block" : "hidden"}>
            <ConnectPayments />
          </div>
          <div className={activeTab === "payouts" ? "block" : "hidden"}>
            <ConnectPayouts />
          </div>
        </div>
      </div>
    </ConnectComponentsProvider>
  )
}
