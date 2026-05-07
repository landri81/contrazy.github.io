export const dynamic = "force-dynamic"

import { VendorTransactionsView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorTransactionsPageData } from "@/features/dashboard/server/dashboard-data"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; kind?: string }>
}) {
  const { session } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam, q, status, kind } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getVendorTransactionsPageData(session.user.email, pagination.page, PAGE_SIZE, { q, status, kind })

  return <VendorTransactionsView data={data} searchParams={compactSearchParams({ q, status, kind })} />
}
