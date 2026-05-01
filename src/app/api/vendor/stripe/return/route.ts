import { NextResponse } from "next/server"
import { ensureVendorApproved, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl, stripe } from "@/lib/integrations/stripe"

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

    const account = await stripe.accounts.retrieve(vendorProfile.stripeAccountId)

    // Update connection status based on whether the account is fully onboarded
    if (account.details_submitted) {
      await prisma.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: { stripeConnectionStatus: "CONNECTED" },
      })
    } else {
      await prisma.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: { stripeConnectionStatus: "PENDING" },
      })
    }

    return NextResponse.redirect(new URL("/vendor/stripe", origin))
  } catch (error) {
    console.error("Stripe Return Error:", error)
    return NextResponse.redirect(new URL("/vendor/stripe?error=verification_failed", getAppBaseUrl()))
  }
}
