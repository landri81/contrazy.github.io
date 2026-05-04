export const dynamic = "force-dynamic"

import { AlertCircle, CheckCircle2, Info, ShieldAlert, Unlink } from "lucide-react"

import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { StripeConnectCard } from "@/features/dashboard/components/stripe-connect-card"
import { StripeDisconnectAction } from "@/features/dashboard/components/stripe-disconnect-action"
import { StripeEmbeddedDashboard } from "@/features/dashboard/components/stripe-embedded-dashboard"
import { getStripePublishableKey } from "@/lib/integrations/stripe"

const STATUS_BANNERS = {
  connected: {
    icon: CheckCircle2,
    title: "Stripe account connected",
    description: "Your account is fully verified and ready to process payments and deposit holds.",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    iconCls: "text-emerald-600 dark:text-emerald-400",
  },
  incomplete: {
    icon: AlertCircle,
    title: "Onboarding incomplete",
    description: "Some required information is still missing. Resume onboarding below to finish connecting.",
    cls: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    iconCls: "text-amber-600 dark:text-amber-400",
  },
  error: {
    icon: AlertCircle,
    title: "Verification failed",
    description: "We couldn't verify your Stripe account. Please try again or contact support.",
    cls: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
    iconCls: "text-red-600 dark:text-red-400",
  },
  no_account: {
    icon: Info,
    title: "No Stripe account linked",
    description: "It looks like your account wasn't saved. Start the connection process below.",
    cls: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
    iconCls: "text-blue-600 dark:text-blue-400",
  },
  disconnected: {
    icon: Unlink,
    title: "Stripe account disconnected",
    description: "Your Stripe account has been unlinked. Connect a new account below to resume payment processing.",
    cls: "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
    iconCls: "text-slate-500 dark:text-slate-400",
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

  const banner = status && status in STATUS_BANNERS ? STATUS_BANNERS[status as StatusKey] : null
  const isConnected = vendorProfile.stripeConnectionStatus === "CONNECTED"
  const isRestricted = vendorProfile.stripeConnectionStatus === "ERROR"
  const showDashboard = isConnected || isRestricted

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments Setup</h1>
        <p className="mt-2 text-muted-foreground">
          Connect your Stripe account to receive payments and authorize deposits directly.
        </p>
      </div>

      {/* Return-redirect status banner */}
      {banner ? (
        <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${banner.cls}`}>
          <banner.icon className={`mt-0.5 size-5 shrink-0 ${banner.iconCls}`} />
          <div>
            <p className="font-semibold">{banner.title}</p>
            <p className="mt-0.5 opacity-90">{banner.description}</p>
          </div>
        </div>
      ) : null}

      {/* Restriction warning (driven by webhook account.updated) */}
      {isRestricted ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/40 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-semibold">Account restricted by Stripe</p>
            <p className="mt-0.5 opacity-90">
              Stripe has restricted your account due to missing or invalid information. Payouts and payments may be paused.
              Open the <strong>Alerts</strong> tab below to see exactly what&apos;s required and resolve it.
            </p>
          </div>
        </div>
      ) : null}

      {/* Connection card (only shown when not connected/restricted) */}
      {!showDashboard ? (
        <div className="max-w-2xl">
          <StripeConnectCard profile={vendorProfile} />
        </div>
      ) : null}

      {/* Embedded Stripe dashboard (connected or restricted) */}
      {showDashboard ? (
        <StripeEmbeddedDashboard publishableKey={getStripePublishableKey()} />
      ) : null}

      {/* Disconnect section — only shown when a Stripe account is linked */}
      {showDashboard ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Disconnect Stripe</p>
              <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                Remove the Stripe account link from your profile. Your Stripe account itself will not be deleted.
                Active transactions with pending payments must be resolved first.
              </p>
            </div>
            <div className="shrink-0">
              <StripeDisconnectAction />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
