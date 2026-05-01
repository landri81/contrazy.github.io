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

    const account = await stripe.accounts.retrieve(dbUser.vendorProfile.stripeAccountId)

    // Update connection status based on whether the account is fully onboarded
    if (account.details_submitted) {
      await prisma.vendorProfile.update({
        where: { id: dbUser.vendorProfile.id },
        data: { stripeConnectionStatus: "CONNECTED" },
      })
    } else {
      await prisma.vendorProfile.update({
        where: { id: dbUser.vendorProfile.id },
        data: { stripeConnectionStatus: "PENDING" },
      })
    }

    return NextResponse.redirect(new URL("/vendor/stripe", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
  } catch (error) {
    console.error("Stripe Return Error:", error)
    return NextResponse.redirect(new URL("/vendor/stripe?error=verification_failed", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
  }
}
