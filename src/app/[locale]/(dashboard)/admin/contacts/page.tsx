import { AdminContactListView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminContacts } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

export default async function AdminContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  await requireAdminAccess()
  const { page: pageParam, q, status } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getAdminContacts(pagination.page, PAGE_SIZE, { q, status })

  return <AdminContactListView data={data} searchParams={compactSearchParams({ q, status })} />
}
