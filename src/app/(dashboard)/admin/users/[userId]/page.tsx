import { notFound } from "next/navigation"

import { AdminUserDetailView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminUserDetail } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  await requireAdminAccess()
  const { userId } = await params
  const user = await getAdminUserDetail(userId)

  if (!user) {
    notFound()
  }

  return <AdminUserDetailView user={user} />
}
