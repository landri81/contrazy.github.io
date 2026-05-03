import { VendorLinksView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorLinksPageData } from "@/features/dashboard/server/dashboard-data"
import { requireVendorAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; state?: string; kind?: string }>
}) {
  const { session } = await requireVendorAccess()
  const { page: pageParam, q, state, kind } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  const data = await getVendorLinksPageData(session.user.email, pagination.page, PAGE_SIZE, { q, state, kind })

  return <VendorLinksView data={data} searchParams={compactSearchParams({ q, state, kind })} />
}
