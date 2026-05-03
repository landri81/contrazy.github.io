import { redirect } from "next/navigation"

import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function StripeReturnPage() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()

    if (!vendorProfile.stripeAccountId) {
      redirect("/vendor/stripe?status=no_account")
    }

    const account = await stripe.accounts.retrieve(vendorProfile.stripeAccountId)

    if (account.details_submitted) {
      await prisma.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: { stripeConnectionStatus: "CONNECTED" },
      })
      redirect("/vendor/stripe?status=connected")
    } else {
      await prisma.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: { stripeConnectionStatus: "PENDING" },
      })
      redirect("/vendor/stripe?status=incomplete")
    }
  } catch (error) {
    // redirect() throws internally — re-throw it so Next.js handles the navigation
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("Stripe return error:", error)
    redirect("/vendor/stripe?status=error")
  }
}
