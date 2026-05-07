import { getTranslations } from "next-intl/server"
import { VendorBillingWorkspace } from "@/features/subscriptions/components/vendor-billing-workspace"
import { getBillingWorkspace } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { getStripePublishableKey } from "@/lib/integrations/stripe"

export const dynamic = "force-dynamic"

export default async function VendorBillingPage() {
  const t = await getTranslations("dashboard.vendor.billing")
  const { vendorProfile } = await requireVendorProfileAccess()
  const workspace = await getBillingWorkspace(vendorProfile.id)
  const stripePublishableKey = getStripePublishableKey()

  return (
    <div className="space-y-2">
      <div className="mb-4 bg-white p-4 rounded-md shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <VendorBillingWorkspace workspace={workspace} stripePublishableKey={stripePublishableKey} />
    </div>
  )
}
