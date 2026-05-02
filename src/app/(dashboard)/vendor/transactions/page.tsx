import { VendorTransactionsView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorTransactionsPageData } from "@/features/dashboard/server/dashboard-data"
import { requireVendorAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; kind?: string }>
}) {
  const { session } = await requireVendorAccess()
  const { page: pageParam, q, status, kind } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getVendorTransactionsPageData(session.user.email, pagination.page, PAGE_SIZE, { q, status, kind })

  return <VendorTransactionsView data={data} searchParams={compactSearchParams({ q, status, kind })} />
}
