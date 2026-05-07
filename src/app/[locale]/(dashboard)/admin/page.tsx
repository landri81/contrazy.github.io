import { SuperAdminOverview } from "@/features/dashboard/components/super-admin-overview"
import { getAdminWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminOverviewPage() {
  const { session } = await requireAdminAccess()
  const workspace = await getAdminWorkspace()

  return <SuperAdminOverview email={session.user.email ?? "Admin"} workspace={workspace} />
}
