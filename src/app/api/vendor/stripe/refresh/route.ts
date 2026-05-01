import { NextResponse } from "next/server"
import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

export async function GET() {
  try {
    const { session, dbUser } = await requireVendorAccess()

    if (!dbUser?.vendorProfile?.stripeAccountId) {
      return NextResponse.redirect(new URL("/vendor/stripe", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
    }

    // Refresh link generation
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const accountLink = await stripe.accountLinks.create({
      account: dbUser.vendorProfile.stripeAccountId,
      refresh_url: `${origin}/vendor/stripe/refresh`,
      return_url: `${origin}/vendor/stripe/return`,
      type: "account_onboarding",
    })

    return NextResponse.redirect(accountLink.url)
  } catch (error) {
    console.error("Stripe Refresh Error:", error)
    return NextResponse.redirect(new URL("/vendor/stripe?error=refresh_failed", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
  }
}
