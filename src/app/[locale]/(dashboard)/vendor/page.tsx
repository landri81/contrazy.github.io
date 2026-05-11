export const dynamic = "force-dynamic"

import { VendorOverview } from "@/features/dashboard/components/vendor-overview"
import {
  buildVendorActionsUsage,
  getVendorCreateLinkDialogData,
  getVendorWorkspace,
} from "@/features/dashboard/server/dashboard-data"
import {
  getVendorStatusMessage,
  isVendorApproved,
  requireSubscribedVendorProfileAccess,
} from "@/lib/auth/guards"

export default async function VendorDashboardPage() {
  const { session, subscription, vendorProfile } = await requireSubscribedVendorProfileAccess()
  const [workspace, createLinkDialogData] = await Promise.all([
    getVendorWorkspace(session.user.email),
    getVendorCreateLinkDialogData(session.user.email),
  ])

  return (
    <VendorOverview
      workspace={workspace}
      createLinkDialog={{
        ...createLinkDialogData,
        usage: buildVendorActionsUsage(subscription),
        hasStripe: vendorProfile.stripeConnectionStatus === "CONNECTED",
        canLaunch: isVendorApproved(vendorProfile),
        blockedMessage: getVendorStatusMessage(vendorProfile.reviewStatus),
      }}
    />
  )
}
