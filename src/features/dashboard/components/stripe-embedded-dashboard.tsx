"use client"

import { useCallback, useEffect, useState } from "react"
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

import { cn } from "@/lib/utils"

type Tab = "balances" | "account" | "payments" | "payouts"

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "balances", label: "Overview", icon: BarChart3 },
  { id: "account", label: "Account", icon: CreditCard },
  { id: "payments", label: "Payments", icon: ReceiptText },
  { id: "payouts", label: "Payouts", icon: Wallet },
]

async function fetchClientSecret(): Promise<string> {
  const res = await fetch("/api/vendor/stripe/account-session", { method: "POST" })
  if (!res.ok) throw new Error("Failed to create account session")
  const data = await res.json()
  return data.clientSecret
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
  const [stripeInstance, setStripeInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("balances")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageBg, setPageBg] = useState("#ffffff")

  const initialize = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const bg = resolvePageBackground()
      setPageBg(bg)
      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret,
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
      <div className="flex min-h-52 items-center justify-center gap-2.5 rounded-2xl border border-border bg-muted/20 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading Stripe dashboard…
      </div>
    )
  }

  if (error || !stripeInstance) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 bg-red-50/30 p-8 text-center dark:border-red-900 dark:bg-red-950/20">
        <AlertCircle className="size-6 text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">{error ?? "Something went wrong"}</p>
          <p className="mt-1 text-xs text-red-600/80 dark:text-red-400">The Stripe dashboard could not be loaded.</p>
          <button
            onClick={initialize}
            className="mt-3 cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-400"
          >
            Retry
          </button>
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
