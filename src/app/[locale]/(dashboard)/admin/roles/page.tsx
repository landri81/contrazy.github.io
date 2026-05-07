import { AdminRolesView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminRolesPage() {
  await requireAdminAccess()
  const workspace = await getAdminWorkspace()

  return <AdminRolesView workspace={workspace} />
}
