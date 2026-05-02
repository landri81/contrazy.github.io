import { AdminSessionsView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminSessions } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; role?: string; state?: string }>
}) {
  await requireAdminAccess()
  const { page: pageParam, q, role, state } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getAdminSessions(pagination.page, PAGE_SIZE, { q, role, state })

  return <AdminSessionsView data={data} searchParams={compactSearchParams({ q, role, state })} />
}
