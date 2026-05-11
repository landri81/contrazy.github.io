export const dynamic = "force-dynamic"

import { getVendorStatusMessage, isVendorApproved, requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import {
  buildVendorActionsUsage,
  getVendorCreateLinkDialogData,
  getVendorRecentLinksData,
} from "@/features/dashboard/server/dashboard-data"
import { VendorLinkWorkspace } from "@/features/dashboard/components/vendor-link-workspace"

export default async function VendorActionsPage() {
  const { vendorProfile, session, subscription } = await requireSubscribedVendorProfileAccess()

  const [{ contracts, checklists }, recentLinks] = await Promise.all([
    getVendorCreateLinkDialogData(session.user.email),
    getVendorRecentLinksData(session.user.email, 6),
  ])

  return (
    <div className="space-y-6">
      

      <VendorLinkWorkspace
        contracts={contracts}
        checklists={checklists}
        initialLinks={recentLinks}
        usage={buildVendorActionsUsage(subscription)}
        hasStripe={vendorProfile.stripeConnectionStatus === "CONNECTED"}
        canLaunch={isVendorApproved(vendorProfile)}
        blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
      />
    </div>
  )
}
