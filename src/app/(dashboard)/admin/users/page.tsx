import { AdminUsersView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminUsers } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"
import { compactSearchParams } from "@/lib/pagination"

const PAGE_SIZE = 25

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; role?: string; reviewStatus?: string }>
}) {
  await requireAdminAccess()
  const { page: pageParam, q, role, reviewStatus } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const data = await getAdminUsers(page, PAGE_SIZE, { q, role, reviewStatus })

  return <AdminUsersView data={data} searchParams={compactSearchParams({ q, role, reviewStatus })} />
}
