import { AdminInvitesView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminInvites } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function AdminInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; role?: string; status?: string }>
}) {
  await requireAdminAccess()
  const { page: pageParam, q, role, status } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getAdminInvites(pagination.page, PAGE_SIZE, { q, role, status })

  return <AdminInvitesView data={data} searchParams={compactSearchParams({ q, role, status })} />
}
