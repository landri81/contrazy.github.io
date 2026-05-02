import { NextResponse } from "next/server"
import { ensureVendorApproved, requireVendorProfileAccess } from "@/lib/auth/guards"
import { getAppBaseUrl, stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }
    const origin = getAppBaseUrl()

    if (!vendorProfile.stripeAccountId) {
      return NextResponse.redirect(new URL("/vendor/stripe", origin))
    }

    const accountLink = await stripe.accountLinks.create({
      account: vendorProfile.stripeAccountId,
      refresh_url: `${origin}/vendor/stripe/refresh`,
      return_url: `${origin}/vendor/stripe/return`,
      type: "account_onboarding",
    })

    return NextResponse.redirect(accountLink.url)
  } catch (error) {
    console.error("Stripe Refresh Error:", error)
    return NextResponse.redirect(new URL("/vendor/stripe?error=refresh_failed", getAppBaseUrl()))
  }
}
