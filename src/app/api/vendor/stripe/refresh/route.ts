import { NextResponse } from "next/server"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { getAppBaseUrl, stripe } from "@/lib/integrations/stripe"
import { normalizeLocale, toAbsoluteLocalizedAppUrl, withLocalePath } from "@/lib/i18n/locale-utils"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }
    const origin = getAppBaseUrl()
    const locale = normalizeLocale(vendorProfile.preferredLocale)

    if (!vendorProfile.stripeAccountId) {
      return NextResponse.redirect(new URL(withLocalePath(locale, "/vendor/stripe"), origin))
    }

    const accountLink = await stripe.accountLinks.create({
      account: vendorProfile.stripeAccountId,
      refresh_url: toAbsoluteLocalizedAppUrl(origin, locale, "/vendor/stripe/refresh"),
      return_url: toAbsoluteLocalizedAppUrl(origin, locale, "/vendor/stripe/return"),
      type: "account_onboarding",
    })

    return NextResponse.redirect(accountLink.url)
  } catch (error) {
    console.error("Stripe Refresh Error:", error)
    return NextResponse.redirect(new URL(withLocalePath("en", "/vendor/stripe?error=refresh_failed"), getAppBaseUrl()))
  }
}
