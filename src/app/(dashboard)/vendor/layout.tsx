import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { vendorNavigation, vendorSubscriptionNavigation } from "@/features/dashboard/navigation"
import { hasActiveSubscription } from "@/features/subscriptions/server/feature-gates"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, vendorProfile, subscription } = await requireVendorProfileAccess()
  const navigation = subscription && hasActiveSubscription(subscription) ? vendorNavigation : vendorSubscriptionNavigation

  return (
    <DashboardShell
      navigation={navigation}
      title="Vendor workspace"
      subtitle={vendorProfile.businessName ?? "Vendor operations"}
      actorLabel="Vendor account"
      account={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
        role: session.user.role ?? null,
      }}
    >
      {children}
    </DashboardShell>
  )
}
