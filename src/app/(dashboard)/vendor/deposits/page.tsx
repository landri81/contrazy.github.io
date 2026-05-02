import { VendorDepositsView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorDepositsPageData } from "@/features/dashboard/server/dashboard-data"
import { requireVendorAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorDepositsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const { session } = await requireVendorAccess()
  const { page: pageParam, q, status } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getVendorDepositsPageData(session.user.email, pagination.page, PAGE_SIZE, { q, status })

  return <VendorDepositsView data={data} searchParams={compactSearchParams({ q, status })} />
}
