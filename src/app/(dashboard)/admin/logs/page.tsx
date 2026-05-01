import { AdminLogsView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminLogsPage() {
  await requireAdminAccess()
  const workspace = await getAdminWorkspace()

  return <AdminLogsView workspace={workspace} />
}
