import { VendorBillingWorkspace } from "@/features/subscriptions/components/vendor-billing-workspace"
import { getBillingWorkspace } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { getStripePublishableKey } from "@/lib/integrations/stripe"

export const dynamic = "force-dynamic"

export default async function VendorBillingPage() {
  const { vendorProfile } = await requireVendorProfileAccess()
  const workspace = await getBillingWorkspace(vendorProfile.id)
  const stripePublishableKey = getStripePublishableKey()

  return (
    <div className="space-y-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription, payment method, and invoices.
        </p>
      </div>
      <VendorBillingWorkspace workspace={workspace} stripePublishableKey={stripePublishableKey} />
    </div>
  )
}
