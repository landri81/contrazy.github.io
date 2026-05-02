import { DashboardShell } from "@/features/dashboard/components/dashboard-shell"
import { adminNavigation } from "@/features/dashboard/navigation"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = await requireAdminAccess()

  return (
    <DashboardShell
      navigation={adminNavigation}
      title="Admin workspace"
      subtitle="Platform oversight"
      actorLabel="Admin account"
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
