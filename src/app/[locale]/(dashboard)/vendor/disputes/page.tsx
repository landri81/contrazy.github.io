export const dynamic = "force-dynamic"

import { VendorDisputesView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorDisputesPageData } from "@/features/dashboard/server/dashboard-data"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const { session } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam, q, status } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getVendorDisputesPageData(session.user.email, pagination.page, PAGE_SIZE, { q, status })

  return <VendorDisputesView data={data} searchParams={compactSearchParams({ q, status })} />
}
