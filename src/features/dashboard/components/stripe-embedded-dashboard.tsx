"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
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
import { AnimatePresence,motion } from "framer-motion"

type Tab = "balances" | "account" | "payments" | "payouts"

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
        message: data?.message ?? "",
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

function createReadyTabs(value = false): Record<Tab, boolean> {
  return {
    balances: value,
    account: value,
    payments: value,
    payouts: value,
  }
}

export function StripeEmbeddedDashboard({ publishableKey }: { publishableKey: string }) {
  const t = useTranslations("dashboard.vendor.stripeEmbedded")
  const router = useRouter()

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "balances", label: t("tabs.balances"), icon: BarChart3 },
    { id: "account", label: t("tabs.account"), icon: CreditCard },
    { id: "payments", label: t("tabs.payments"), icon: ReceiptText },
    { id: "payouts", label: t("tabs.payouts"), icon: Wallet },
  ]

  const embeddedRootRef = useRef<HTMLDivElement | null>(null)

  const [stripeInstance, setStripeInstance] =
    useState<ReturnType<typeof loadConnectAndInitialize> | null>(null)

  const [activeTab, setActiveTab] = useState<Tab>("balances")
  const [isLoading, setIsLoading] = useState(true)
  const [isEmbeddedBooting, setIsEmbeddedBooting] = useState(false)
  const [readyTabs, setReadyTabs] = useState<Record<Tab, boolean>>(() =>
    createReadyTabs(false)
  )

  const [error, setError] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<AccountSessionError | null>(null)
  const [loadStage, setLoadStage] = useState<LoadStage>("session")
  const [loadDetail, setLoadDetail] = useState(t("loading.preparingSession"))
  const [pageBg, setPageBg] = useState("#ffffff")

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]
  const activeTabReady = readyTabs[activeTab]

  const initialize = useCallback(async () => {
    setIsLoading(true)
    setIsEmbeddedBooting(false)
    setError(null)
    setSessionError(null)
    setStripeInstance(null)
    setReadyTabs(createReadyTabs(false))
    setLoadStage("session")
    setLoadDetail(t("loading.preparingSession"))

    try {
      const bg = resolvePageBackground()
      setPageBg(bg)

      const sessionResult = await fetchAccountSession()

      if (!sessionResult.ok) {
        setSessionError({
          ...sessionResult.error,
          message: sessionResult.error.message || t("errors.sessionFailed"),
        })
        return
      }

      setLoadStage("dashboard")
      setLoadDetail(sessionResult.data.message ?? t("loading.loadingTools"))

      const isCompactViewport =
        typeof window !== "undefined" && window.innerWidth < 640

      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => sessionResult.data.clientSecret,
        appearance: {
          overlays: "dialog",
          variables: {
            colorPrimary: "#13c2aa",
            colorBackground: bg,
            borderRadius: isCompactViewport ? "6px" : "8px",
            fontFamily: "inherit",
            spacingUnit: isCompactViewport ? "8px" : "10px",
          },
        },
      })

      setStripeInstance(instance)
    } catch {
      setError(t("errors.initFailed"))
    } finally {
      setIsLoading(false)
    }
  }, [publishableKey, t])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void initialize()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [initialize])

  useEffect(() => {
    if (!stripeInstance || isLoading) return

    if (readyTabs[activeTab]) {
      setIsEmbeddedBooting(false)
      return
    }

    const root = embeddedRootRef.current
    const panel = root?.querySelector<HTMLElement>(
      `[data-stripe-embedded-panel="${activeTab}"]`
    )

    if (!panel) return

    let disposed = false
    let observer: MutationObserver | null = null

    const startedAt = Date.now()
    const minVisibleMs = 700
    const maxVisibleMs = 3200

    function hasEmbeddedContent() {
      if (!panel) return false

      const iframe = panel.querySelector("iframe")

      const hasMeaningfulSize =
        panel.getBoundingClientRect().height > 160 &&
        panel.getBoundingClientRect().width > 240

      const hasNestedNodes =
        panel.querySelector("*") !== null && panel.childElementCount > 0

      return Boolean(iframe || (hasMeaningfulSize && hasNestedNodes))
    }

    function markReady() {
      if (disposed) return

      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, minVisibleMs - elapsed)

      window.setTimeout(() => {
        if (disposed) return

        setReadyTabs((current) => ({
          ...current,
          [activeTab]: true,
        }))

        setIsEmbeddedBooting(false)
      }, remaining)
    }

    setIsEmbeddedBooting(true)

    const firstFrame = window.requestAnimationFrame(() => {
      if (hasEmbeddedContent()) {
        markReady()
        return
      }

      observer = new MutationObserver(() => {
        if (hasEmbeddedContent()) {
          observer?.disconnect()
          markReady()
        }
      })

      observer.observe(panel, {
        childList: true,
        subtree: true,
        attributes: true,
      })
    })

    const softCheckTimer = window.setTimeout(() => {
      if (hasEmbeddedContent()) {
        observer?.disconnect()
        markReady()
      }
    }, 900)

    const maxTimer = window.setTimeout(() => {
      observer?.disconnect()
      markReady()
    }, maxVisibleMs)

    return () => {
      disposed = true
      observer?.disconnect()
      window.cancelAnimationFrame(firstFrame)
      window.clearTimeout(softCheckTimer)
      window.clearTimeout(maxTimer)
    }
  }, [activeTab, isLoading, readyTabs, stripeInstance])

  function handleTabChange(nextTab: Tab) {
    setActiveTab(nextTab)

    if (!readyTabs[nextTab]) {
      setIsEmbeddedBooting(true)
    }
  }

  if (isLoading && !stripeInstance) {
    return (
      <div className="rounded-[26px] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,1))] p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] ring-1 ring-[var(--contrazy-teal)]/12">
              <Loader2 className="size-4 animate-spin" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {loadStage === "session"
                  ? t("loading.stageSession")
                  : t("loading.stageDashboard")}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {t("loading.openingWorkspace")}
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            {loadStage === "session" ? "1/2" : "2/2"}
          </span>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground sm:text-sm">
          {loadDetail}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: t("loading.session"),
              state:
                loadStage === "session"
                  ? t("loading.working")
                  : t("loading.ready"),
            },
            {
              label: t("loading.tools"),
              state:
                loadStage === "dashboard"
                  ? t("loading.opening")
                  : t("loading.queued"),
            },
            { label: t("loading.balances"), state: t("loading.pending") },
            { label: t("loading.payouts"), state: t("loading.pending") },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-border/70 bg-background/85 px-3 py-2.5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {item.state}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 rounded-[22px] border border-border/70 bg-background/75 p-3 sm:grid-cols-2">
          <div className="h-10 rounded-xl bg-muted/70" />
          <div className="h-10 rounded-xl bg-muted/70" />
          <div className="h-32 rounded-2xl bg-muted/55 sm:col-span-2" />
        </div>
      </div>
    )
  }

  if (sessionError || error || !stripeInstance) {
    const isSubscriptionIssue =
      sessionError?.status === 402 ||
      sessionError?.code === "SUBSCRIPTION_REQUIRED"

    const isMissingAccount = sessionError?.code === "NO_STRIPE_ACCOUNT"

    const title = isSubscriptionIssue
      ? t("errors.subscriptionRequired")
      : isMissingAccount
        ? t("errors.accountUnavailable")
        : error ?? t("errors.generic")

    const description = sessionError?.message || t("errors.loadFailed")

    return (
      <div className="rounded-[26px] border border-red-200 bg-red-50/50 p-4 text-left shadow-sm dark:border-red-900 dark:bg-red-950/20 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
            <AlertCircle className="size-4.5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                {title}
              </p>
              <span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700 dark:border-red-800 dark:bg-transparent dark:text-red-300">
                {t("errors.toolsBadge")}
              </span>
            </div>

            <p className="mt-1 text-xs leading-5 text-red-700/85 dark:text-red-400 sm:text-sm">
              {description}
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {sessionError?.redirectTo ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-400"
                  onClick={() => {
                    window.location.href = sessionError.redirectTo!
                  }}
                >
                  {t("errors.openBilling")}
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
                  {t("errors.refreshStatus")}
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-transparent dark:text-red-400"
                onClick={initialize}
              >
                {t("errors.retry")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeInstance}>
      <div className="space-y-2.5">
        <div className="[&>*]:!rounded-[20px] [&>*]:!border [&>*]:!border-amber-200 [&>*]:!shadow-none">
          <ConnectNotificationBanner />
        </div>

        <div className="rounded-[22px] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.98))] p-2.5 shadow-sm sm:p-3">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("shell.liveTools")}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {t("shell.chooseModule")}
              </p>
            </div>

            <span className="inline-flex w-fit shrink-0 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {activeTabMeta.label}
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:mt-3 sm:grid-cols-4 sm:gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                aria-pressed={activeTab === tab.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-start gap-2 rounded-[16px] border px-2.5 py-2 text-left text-[13px] font-medium transition-all sm:min-h-11 sm:justify-center sm:px-3 sm:py-2.5 sm:text-sm",
                  activeTab === tab.id
                    ? "border-[var(--contrazy-teal)]/25 bg-[var(--contrazy-teal)]/10 text-foreground shadow-sm"
                    : "border-border/60 bg-background/82 text-muted-foreground hover:border-border hover:bg-white hover:text-foreground"
                )}
              >
                <tab.icon className="size-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          ref={embeddedRootRef}
          className="scrollbar-thin-subtle relative min-h-[360px] overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-[24px] border border-border/80 bg-white/80 p-2 shadow-sm"
          style={{ backgroundColor: pageBg }}
        >
          <AnimatePresence initial={false}>
            {isEmbeddedBooting && !activeTabReady ? (
              <motion.div
                key={`embedded-loading-${activeTab}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-2 z-20 flex items-center justify-center rounded-[20px] border border-border/70 bg-background/90 backdrop-blur-sm"
              >
                <div className="w-full max-w-md px-4 py-5 text-center">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] ring-1 ring-[var(--contrazy-teal)]/15">
                    <Loader2 className="size-4 animate-spin" />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {t("loading.openingWorkspace")}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {activeTabMeta.label}
                  </p>

                  <div className="mt-4 grid gap-2 text-left">
                    <div className="h-10 rounded-xl bg-muted/70" />
                    <div className="h-10 rounded-xl bg-muted/60" />
                    <div className="h-24 rounded-2xl bg-muted/50" />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            data-stripe-embedded-panel="balances"
            className={activeTab === "balances" ? "block" : "hidden"}
          >
            <div className="min-w-[320px] px-1.5 py-1.5 sm:min-w-0 sm:px-2 sm:py-2">
              <ConnectBalances />
            </div>
          </div>

          <div
            data-stripe-embedded-panel="account"
            className={activeTab === "account" ? "block" : "hidden"}
          >
            <div className="min-w-[320px] px-1.5 py-1.5 sm:min-w-0 sm:px-2 sm:py-2">
              <ConnectAccountManagement />
            </div>
          </div>

          <div
            data-stripe-embedded-panel="payments"
            className={activeTab === "payments" ? "block" : "hidden"}
          >
            <div className="min-w-[320px] px-1.5 py-1.5 sm:min-w-0 sm:px-2 sm:py-2">
              <ConnectPayments />
            </div>
          </div>

          <div
            data-stripe-embedded-panel="payouts"
            className={activeTab === "payouts" ? "block" : "hidden"}
          >
            <div className="min-w-[320px] px-1.5 py-1.5 sm:min-w-0 sm:px-2 sm:py-2">
              <ConnectPayouts />
            </div>
          </div>
        </div>
      </div>
    </ConnectComponentsProvider>
  )
}
