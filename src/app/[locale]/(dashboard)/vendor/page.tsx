export const dynamic = "force-dynamic"

import { VendorOverview } from "@/features/dashboard/components/vendor-overview"
import { getVendorWorkspace } from "@/features/dashboard/server/dashboard-data"
import { requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"

export default async function VendorDashboardPage() {
  const { session } = await requireSubscribedVendorProfileAccess()
  const workspace = await getVendorWorkspace(session.user.email)

  return <VendorOverview workspace={workspace} />
}
