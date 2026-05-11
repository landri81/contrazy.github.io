export const dynamic = "force-dynamic"

import { VendorClientsView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorClientsPageData } from "@/features/dashboard/server/dashboard-data"
import { getVendorClientsExportAvailableRange } from "@/features/dashboard/server/vendor-clients-export"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { session, vendorProfile } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam, q } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const filters = { q }
  const [data, availableExportRange] = await Promise.all([
    getVendorClientsPageData(session.user.email, pagination.page, PAGE_SIZE, filters),
    getVendorClientsExportAvailableRange(vendorProfile.id, filters),
  ])

  return (
    <VendorClientsView
      data={data}
      searchParams={compactSearchParams(filters)}
      availableExportRange={availableExportRange}
    />
  )
}
