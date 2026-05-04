export const dynamic = "force-dynamic"

import { VendorClientsView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorClientsPageData } from "@/features/dashboard/server/dashboard-data"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { session } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam, q } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getVendorClientsPageData(session.user.email, pagination.page, PAGE_SIZE, { q })

  return <VendorClientsView data={data} searchParams={compactSearchParams({ q })} />
}
