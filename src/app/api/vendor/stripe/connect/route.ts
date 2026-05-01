import { NextResponse } from "next/server"
import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

export async function POST() {
  try {
    const { session, dbUser } = await requireVendorAccess()

    if (!dbUser?.vendorProfile) {
      return NextResponse.json({ success: false, message: "Vendor profile not found" }, { status: 404 })
    }

    const profileId = dbUser.vendorProfile.id
    let stripeAccountId = dbUser.vendorProfile.stripeAccountId

    // If the vendor does not have a connected Stripe account yet, create one
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: dbUser.email,
        business_profile: {
          name: dbUser.vendorProfile.businessName || undefined,
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
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
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
