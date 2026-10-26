export const dynamic = "force-dynamic"

import { VendorWebhooksView } from "@/features/dashboard/components/dashboard-pages"
import { getVendorWebhooksPageData } from "@/features/dashboard/server/dashboard-data"
import { PartnerWebhookEndpointsSection } from "@/features/partner-webhooks/components/partner-webhook-endpoints-section"
import {
  getVendorPartnerWebhooks,
  type VendorPartnerWebhooksData,
} from "@/features/partner-webhooks/server/vendor-webhooks"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { compactSearchParams, resolvePagination } from "@/lib/pagination"

const PAGE_SIZE = 20

export default async function VendorWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>
}) {
  const { session, dbUser, vendorProfile } = await requireSubscribedVendorProfileAccess()
  const { page: pageParam, q, status } = await searchParams
  const pagination = resolvePagination({ page: pageParam, pageSize: PAGE_SIZE }, { defaultPageSize: PAGE_SIZE })
  // Partner endpoints and their deliveries are owner-only, like API keys.
  const isOwner = vendorProfile.userId === dbUser.id
  const [data, partnerData] = await Promise.all([
    getVendorWebhooksPageData(session.user.email, pagination.page, PAGE_SIZE, { q, status }),
    isOwner ? loadPartnerWebhooks(vendorProfile.id) : Promise.resolve(null),
  ])

  return (
    <div className="space-y-6">
      <VendorWebhooksView data={data} searchParams={compactSearchParams({ q, status })} />
      <PartnerWebhookEndpointsSection initialData={partnerData} canManage={isOwner} />
    </div>
  )
}

async function loadPartnerWebhooks(vendorId: string): Promise<VendorPartnerWebhooksData | null> {
  try {
    return await getVendorPartnerWebhooks(vendorId)
  } catch (error) {
    console.error("Partner webhooks section load failed", error instanceof Error ? error.message : error)
    return null
  }
}
