export const dynamic = "force-dynamic"

import { VendorTransactionsView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorTransactionsPageData } from "@/features/dashboard/server/dashboard-data"
import { getVendorTransactionsExportAvailableRange } from "@/features/dashboard/server/vendor-transactions-export"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; kind?: string }>
}) {
  const { session, vendorProfile } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam, q, status, kind } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const filters = { q, status, kind }
  const [data, availableExportRange] = await Promise.all([
    getVendorTransactionsPageData(session.user.email, pagination.page, PAGE_SIZE, filters),
    getVendorTransactionsExportAvailableRange(vendorProfile.id, filters),
  ])

  return (
    <VendorTransactionsView
      data={data}
      searchParams={compactSearchParams(filters)}
      availableExportRange={availableExportRange}
    />
  )
}
