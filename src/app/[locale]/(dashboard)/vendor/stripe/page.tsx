export const dynamic = "force-dynamic"

import {
  AlertCircle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Sparkles,
  Unlink,
} from "lucide-react"
import { getTranslations } from "next-intl/server"

import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { StripeConnectCard } from "@/features/dashboard/components/stripe-connect-card"
import { StripeDisconnectAction } from "@/features/dashboard/components/stripe-disconnect-action"
import { StripeEmbeddedDashboard } from "@/features/dashboard/components/stripe-embedded-dashboard"
import { getStripePublishableKey } from "@/lib/integrations/stripe"

type StatusKey = "connected" | "incomplete" | "error" | "no_account" | "disconnected"

const STATUS_CLS: Record<StatusKey, { icon: React.ElementType; cls: string; iconCls: string; dotCls: string }> = {
  connected: {
    icon: CheckCircle2,
    cls: "border-emerald-200/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100",
    iconCls: "text-emerald-600 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
  },
  incomplete: {
    icon: AlertCircle,
    cls: "border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
    iconCls: "text-amber-600 dark:text-amber-400",
    dotCls: "bg-amber-500",
  },
  error: {
    icon: AlertCircle,
    cls: "border-red-200/70 bg-red-50/80 text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100",
    iconCls: "text-red-600 dark:text-red-400",
    dotCls: "bg-red-500",
  },
  no_account: {
    icon: Info,
    cls: "border-blue-200/70 bg-blue-50/80 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100",
    iconCls: "text-blue-600 dark:text-blue-400",
    dotCls: "bg-blue-500",
  },
  disconnected: {
    icon: Unlink,
    cls: "border-slate-200/70 bg-slate-50/80 text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-200",
    iconCls: "text-slate-500 dark:text-slate-400",
    dotCls: "bg-slate-400",
  },
}

export default async function VendorStripePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const t = await getTranslations("dashboard.vendor.stripePage")
  const { vendorProfile } = await requireSubscribedVendorProfileAccess()
  const { status } = await searchParams

  const bannerKey = status && status in STATUS_CLS ? (status as StatusKey) : null
  const bannerCls = bannerKey ? STATUS_CLS[bannerKey] : null
  const bannerTitle = bannerKey ? t(`statusBanners.${bannerKey}.title`) : null
  const bannerDesc = bannerKey ? t(`statusBanners.${bannerKey}.description`) : null

  const isConnected = vendorProfile.stripeConnectionStatus === "CONNECTED"
  const isRestricted = vendorProfile.stripeConnectionStatus === "ERROR"
  const showDashboard = isConnected || isRestricted

  const afterConnectionItems = [
    t("afterConnection.item1"),
    t("afterConnection.item2"),
    t("afterConnection.item3"),
  ]

  return (
    <div className="space-y-4 sm:space-y-5">

      {bannerCls && bannerTitle && bannerDesc ? (
        <div className={`rounded-[24px] border p-4 text-sm shadow-sm backdrop-blur-xl sm:p-5 ${bannerCls.cls}`}>
          <div className="flex items-start gap-3">
            <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-white/10">
              <span className={`absolute right-2 top-2 size-2 rounded-full ${bannerCls.dotCls}`} />
              <bannerCls.icon className={`size-5 ${bannerCls.iconCls}`} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{bannerTitle}</p>
              <p className="mt-1 leading-6 opacity-90">{bannerDesc}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isRestricted ? (
        <div className="rounded-[24px] border border-red-200/70 bg-red-50/80 p-4 text-sm text-red-950 shadow-sm backdrop-blur-xl dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-100 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
              <ShieldAlert className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{t("actionRequired.title")}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">{t("actionRequired.description")}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!showDashboard ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            <StripeConnectCard profile={vendorProfile} />
          </div>

          <div className="rounded-[26px] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,1))] p-4 shadow-sm sm:p-5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
              <Sparkles className="size-5" />
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("afterConnection.tag")}
            </p>
            <h2 className="mt-2 text-base font-semibold text-foreground">{t("afterConnection.title")}</h2>

            <div className="mt-4 space-y-2.5">
              {afterConnectionItems.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-2xl border border-border/70 bg-background/85 px-3 py-2.5 text-sm text-muted-foreground shadow-sm"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--contrazy-teal)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {showDashboard ? (
        <StripeEmbeddedDashboard publishableKey={getStripePublishableKey()} />
      ) : null}

      {showDashboard ? (
        <section className="rounded-[24px] border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <Unlink className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{t("disconnect.title")}</p>
                <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">{t("disconnect.description")}</p>
              </div>
            </div>
            <div className="shrink-0 md:pl-4">
              <StripeDisconnectAction />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
