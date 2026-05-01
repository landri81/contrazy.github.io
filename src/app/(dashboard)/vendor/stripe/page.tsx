import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { StripeConnectCard } from "@/features/dashboard/components/stripe-connect-card"

export default async function VendorStripePage() {
  const { vendorProfile } = await requireVendorProfileAccess()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments Setup</h1>
        <p className="text-muted-foreground mt-2">
          Connect your Stripe account to receive payments and authorize deposits directly.
        </p>
      </div>

      <div className="max-w-2xl">
        <StripeConnectCard profile={vendorProfile} />
      </div>
    </div>
  )
}
