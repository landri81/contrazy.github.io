export const dynamic = "force-dynamic"

import { VendorLinksView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorLinksPageData } from "@/features/dashboard/server/dashboard-data"
import { getVendorLinksExportAvailableRange } from "@/features/dashboard/server/vendor-links-export"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; state?: string; kind?: string }>
}) {
  const { session, vendorProfile } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam, q, state, kind } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const filters = { q, state, kind }
  const [data, availableExportRange] = await Promise.all([
    getVendorLinksPageData(session.user.email, pagination.page, PAGE_SIZE, filters),
    getVendorLinksExportAvailableRange(vendorProfile.id, filters),
  ])

  return (
    <VendorLinksView
      data={data}
      searchParams={compactSearchParams(filters)}
      availableExportRange={availableExportRange}
    />
  )
}
