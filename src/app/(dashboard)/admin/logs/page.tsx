import { AdminLogsView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminLogs } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; source?: string }>
}) {
  await requireAdminAccess()
  const { page: pageParam, q, source } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getAdminLogs(pagination.page, PAGE_SIZE, { q, source })

  return <AdminLogsView data={data} searchParams={compactSearchParams({ q, source })} />
}
