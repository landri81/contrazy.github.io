import { redirect } from "next/navigation"

import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"
import { stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function StripeReturnPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: rawLocale } = await params
  const locale = normalizeLocale(rawLocale)
  try {
    const { vendorProfile } = await requireSubscribedVendorProfileAccess()

    if (!vendorProfile.stripeAccountId) {
      redirect(withLocalePath(locale, "/vendor/stripe?status=no_account"))
    }

    const account = await stripe.accounts.retrieve(vendorProfile.stripeAccountId)

    if (account.details_submitted) {
      await prisma.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: { stripeConnectionStatus: "CONNECTED" },
      })
      redirect(withLocalePath(locale, "/vendor/stripe?status=connected"))
    } else {
      await prisma.vendorProfile.update({
        where: { id: vendorProfile.id },
        data: { stripeConnectionStatus: "PENDING" },
      })
      redirect(withLocalePath(locale, "/vendor/stripe?status=incomplete"))
    }
  } catch (error) {
    // redirect() throws internally — re-throw it so Next.js handles the navigation
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }
    console.error("Stripe return error:", error)
    redirect(withLocalePath(locale, "/vendor/stripe?status=error"))
  }
}
