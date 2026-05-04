export const dynamic = "force-dynamic"

import {
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  PanelTop,
  ShieldAlert,
  Sparkles,
  Unlink,
} from "lucide-react"

import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { StripeConnectCard } from "@/features/dashboard/components/stripe-connect-card"
import { StripeDisconnectAction } from "@/features/dashboard/components/stripe-disconnect-action"
import { StripeEmbeddedDashboard } from "@/features/dashboard/components/stripe-embedded-dashboard"
import { getStripePublishableKey } from "@/lib/integrations/stripe"

const STATUS_BANNERS = {
  connected: {
    icon: CheckCircle2,
    title: "Stripe account connected",
    description:
      "Your account is fully verified and ready to process payments and deposit holds.",
    cls: "border-emerald-200/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100",
    iconCls: "text-emerald-600 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
  },
  incomplete: {
    icon: AlertCircle,
    title: "Onboarding incomplete",
    description:
      "Some required information is still missing. Resume onboarding below to finish connecting.",
    cls: "border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
    iconCls: "text-amber-600 dark:text-amber-400",
    dotCls: "bg-amber-500",
  },
  error: {
    icon: AlertCircle,
    title: "Verification failed",
    description:
      "We couldn't verify your Stripe account. Please try again or contact support.",
    cls: "border-red-200/70 bg-red-50/80 text-red-950 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100",
    iconCls: "text-red-600 dark:text-red-400",
    dotCls: "bg-red-500",
  },
  no_account: {
    icon: Info,
    title: "No Stripe account linked",
    description:
      "It looks like your account wasn't saved. Start the connection process below.",
    cls: "border-blue-200/70 bg-blue-50/80 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100",
    iconCls: "text-blue-600 dark:text-blue-400",
    dotCls: "bg-blue-500",
  },
  disconnected: {
    icon: Unlink,
    title: "Stripe account disconnected",
    description:
      "Your Stripe account has been unlinked. Connect a new account below to resume payment processing.",
    cls: "border-slate-200/70 bg-slate-50/80 text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-200",
    iconCls: "text-slate-500 dark:text-slate-400",
    dotCls: "bg-slate-400",
  },
} as const

type StatusKey = keyof typeof STATUS_BANNERS

export default async function VendorStripePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { vendorProfile } = await requireSubscribedVendorProfileAccess()
  const { status } = await searchParams

  const banner =
    status && status in STATUS_BANNERS
      ? STATUS_BANNERS[status as StatusKey]
      : null

  const isConnected = vendorProfile.stripeConnectionStatus === "CONNECTED"
  const isRestricted = vendorProfile.stripeConnectionStatus === "ERROR"
  const showDashboard = isConnected || isRestricted

  const statusLabel = isConnected
    ? "Connected"
    : isRestricted
      ? "Restricted"
      : "Not connected"

  const statusTone = isConnected
    ? "bg-emerald-500"
    : isRestricted
      ? "bg-red-500"
      : "bg-amber-500"
  const statusItems = [
    {
      icon: <BadgeCheck className="size-4" />,
      label: "Verification",
      value: isConnected ? "Ready" : isRestricted ? "Needs action" : "Pending",
    },
    {
      icon: <Landmark className="size-4" />,
      label: "Payments",
      value: isConnected ? "Enabled" : isRestricted ? "Paused" : "Setup",
    },
    {
      icon: <PanelTop className="size-4" />,
      label: "Tools",
      value: showDashboard ? "Live" : "After setup",
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5">
      

      {banner ? <StatusBanner banner={banner} /> : null}

      {isRestricted ? (
        <div className="rounded-[24px] border border-red-200/70 bg-red-50/80 p-4 text-sm text-red-950 shadow-sm backdrop-blur-xl dark:border-red-900/70 dark:bg-red-950/25 dark:text-red-100 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
              <ShieldAlert className="size-5" />
            </div>

            <div className="min-w-0">
              <p className="font-semibold">Action needed in Stripe</p>
              <p className="mt-1 text-sm leading-6 opacity-90">
                Stripe needs more information. Open the live alerts below to restore payments and payouts.
              </p>
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
              After connection
            </p>
            <h2 className="mt-2 text-base font-semibold text-foreground">
              Your payment stack turns on
            </h2>

            <div className="mt-4 space-y-2.5">
              {[
                "Collect client payments inside contract links.",
                "Place deposit holds and release unused amounts cleanly.",
                "Route payouts directly into your Stripe account.",
              ].map((item) => (
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
                <p className="text-sm font-semibold text-foreground">
                  Disconnect Stripe
                </p>
                <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
                  Unlink Stripe from this workspace. Active payment or deposit flows should be resolved first.
                </p>
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

function StatusBanner({
  banner,
}: {
  banner: (typeof STATUS_BANNERS)[StatusKey]
}) {
  const Icon = banner.icon

  return (
    <div
      className={`rounded-[24px] border p-4 text-sm shadow-sm backdrop-blur-xl sm:p-5 ${banner.cls}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 shadow-sm dark:bg-white/10">
          <span
            className={`absolute right-2 top-2 size-2 rounded-full ${banner.dotCls}`}
          />
          <Icon className={`size-5 ${banner.iconCls}`} />
        </div>

        <div className="min-w-0">
          <p className="font-semibold">{banner.title}</p>
          <p className="mt-1 leading-6 opacity-90">{banner.description}</p>
        </div>
      </div>
    </div>
  )
}

function MiniStatusItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-[20px] border border-border/70 bg-background/80 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/60">
          {icon}
        </div>
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>

      <span className="mt-2 block text-sm font-semibold leading-5 text-foreground">
        {value}
      </span>
    </div>
  )
}
