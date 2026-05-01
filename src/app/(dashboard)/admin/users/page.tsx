import { AdminUsersView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminUsersPage() {
  await requireAdminAccess()
  const workspace = await getAdminWorkspace()

  return <AdminUsersView workspace={workspace} />
}
