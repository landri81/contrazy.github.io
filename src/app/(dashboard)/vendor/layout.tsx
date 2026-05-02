import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { vendorNavigation } from "@/features/dashboard/navigation"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, vendorProfile } = await requireVendorProfileAccess()

  return (
    <DashboardShell
      navigation={vendorNavigation}
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
