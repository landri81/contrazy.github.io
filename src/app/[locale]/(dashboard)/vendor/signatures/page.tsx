export const dynamic = "force-dynamic"

import { VendorSignaturesView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorSignaturesPageData } from "@/features/dashboard/server/dashboard-data"
import { getVendorSignaturesExportAvailableRange } from "@/features/dashboard/server/vendor-signatures-export"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorSignaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const { session, vendorProfile } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam, q, status } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const filters = { q, status }
  const [data, availableExportRange] = await Promise.all([
    getVendorSignaturesPageData(session.user.email, pagination.page, PAGE_SIZE, filters),
    getVendorSignaturesExportAvailableRange(vendorProfile.id, filters),
  ])

  return (
    <VendorSignaturesView
      data={data}
      searchParams={compactSearchParams(filters)}
      availableExportRange={availableExportRange}
    />
  )
}
