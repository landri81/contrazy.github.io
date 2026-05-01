import { NextResponse } from "next/server"
import { ensureVendorApproved, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl, stripe } from "@/lib/integrations/stripe"

export async function POST() {
  try {
    const { dbUser, vendorProfile } = await requireVendorProfileAccess()
    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const profileId = vendorProfile.id
    let stripeAccountId = vendorProfile.stripeAccountId

    // If the vendor does not have a connected Stripe account yet, create one
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: dbUser.email,
        business_profile: {
          name: vendorProfile.businessName || undefined,
        },
      })

      stripeAccountId = account.id

      // Save the account ID to the profile
      await prisma.vendorProfile.update({
        where: { id: profileId },
        data: { stripeAccountId },
      })
    }

    // Generate account link for onboarding
    const origin = getAppBaseUrl()
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/vendor/stripe/refresh`,
      return_url: `${origin}/vendor/stripe/return`,
      type: "account_onboarding",
    })

    return NextResponse.json({
      success: true,
      url: accountLink.url,
    })
  } catch (error) {
    console.error("Stripe Connect Error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to initialize Stripe Connect" },
      { status: 500 }
    )
  }
}
