import { AdminVendorListView } from "@/features/dashboard/components/dashboard-pages"
import { getAdminVendors } from "@/features/dashboard/server/dashboard-data"
import { requireAdminAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; reviewStatus?: string; stripeStatus?: string }>
}) {
  await requireAdminAccess()
  const { page: pageParam, q, reviewStatus, stripeStatus } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getAdminVendors(pagination.page, PAGE_SIZE, { q, reviewStatus, stripeStatus })

  return <AdminVendorListView data={data} searchParams={compactSearchParams({ q, reviewStatus, stripeStatus })} />
}
