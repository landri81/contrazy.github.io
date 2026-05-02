import { VendorDisputesView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorDisputesPageData } from "@/features/dashboard/server/dashboard-data"
import { requireVendorAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const { session } = await requireVendorAccess()
  const { page: pageParam, q, status } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getVendorDisputesPageData(session.user.email, pagination.page, PAGE_SIZE, { q, status })

  return <VendorDisputesView data={data} searchParams={compactSearchParams({ q, status })} />
}
