import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { vendorNavigation } from "@/features/dashboard/navigation"
import { requireVendorAccess } from "@/lib/auth/guards"

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, dbUser } = await requireVendorAccess()

  return (
    <DashboardShell
      navigation={vendorNavigation}
      title="Vendor workspace"
      subtitle={dbUser?.vendorProfile?.businessName ?? "Vendor operations"}
      actorLabel={session.user.email ?? "Vendor"}
    >
      {children}
    </DashboardShell>
  )
}
