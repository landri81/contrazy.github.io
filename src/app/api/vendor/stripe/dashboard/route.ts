import { NextResponse } from "next/server"

import { ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { getAppBaseUrl, getStripeDashboardUrl, stripe } from "@/lib/integrations/stripe"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const origin = getAppBaseUrl()
    const locale = normalizeLocale(vendorProfile.preferredLocale)

    if (!vendorProfile.stripeAccountId) {
      return NextResponse.redirect(
        new URL(withLocalePath(locale, "/vendor/stripe?status=no_account"), origin)
      )
    }

    const account = await stripe.accounts.retrieve(vendorProfile.stripeAccountId)

    if ("deleted" in account && account.deleted) {
      return NextResponse.redirect(
        new URL(withLocalePath(locale, "/vendor/stripe?status=no_account"), origin)
      )
    }

    if (account.type === "express") {
      const loginLink = await stripe.accounts.createLoginLink(account.id)
      return NextResponse.redirect(loginLink.url)
    }

    const dashboardUrl = getStripeDashboardUrl()

    return NextResponse.redirect(dashboardUrl)
  } catch (error) {
    console.error("Stripe dashboard redirect error:", error)
    return NextResponse.redirect(
      new URL(withLocalePath("en", "/vendor/stripe?status=error"), getAppBaseUrl())
    )
  }
}
