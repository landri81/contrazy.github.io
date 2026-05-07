import { SuperAdminOverview } from "@/features/dashboard/components/super-admin-overview"
import { getAdminAnalytics, getAdminWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminOverviewPage() {
  const { session } = await requireAdminAccess()
  const [workspace, analytics] = await Promise.all([
    getAdminWorkspace(),
    getAdminAnalytics(),
  ])

  return (
    <SuperAdminOverview
      email={session.user.email ?? "Admin"}
      workspace={workspace}
      analytics={analytics}
    />
  )
}
