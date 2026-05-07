import { redirect } from "next/navigation"
import { CreditCard, ShieldCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Badge } from "@/components/ui/badge"
import { SubscriptionPricingGrid } from "@/features/subscriptions/components/subscription-pricing-grid"
import { getVendorSubscriptionAccessState } from "@/features/subscriptions/server/subscription-service"
import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export const dynamic = "force-dynamic"

export default async function VendorSubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ canceled?: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  const t = await getTranslations("dashboard.vendor.subscribePage")
  const { vendorProfile } = await requireVendorProfileAccess()
  const accessState = await getVendorSubscriptionAccessState(vendorProfile.id)
  const { canceled } = await searchParams

  if (accessState.allowed) {
    redirect(withLocalePath(locale, "/vendor/billing"))
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(180deg,#ffffff,rgba(244,248,249,0.94))] p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <Badge className="w-fit border-transparent bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] hover:bg-[var(--contrazy-teal)]/10">
              {t("badge")}
            </Badge>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t("heading")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {t("description")}
              </p>
            </div>
            {canceled === "1" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t("canceledNote")}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-border bg-background/90 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t("billingAccessTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("billingAccessDesc")}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-background/90 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--contrazy-navy)]/8 text-[var(--contrazy-navy)]">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t("profileStaysOpenTitle")}</p>
                  <p className="text-sm text-muted-foreground">{t("profileStaysOpenDesc")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--contrazy-teal)] uppercase">{t("pricingSectionLabel")}</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("pricingSectionHeading")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {t("pricingSectionDesc")}
          </p>
        </div>
        <SubscriptionPricingGrid
          mode="vendor"
          viewerRole="VENDOR"
          initialInterval={accessState.subscription?.billingInterval === "YEARLY" ? "yearly" : "monthly"}
        />
      </section>
    </div>
  )
}
