export const dynamic = "force-dynamic"

import { getVendorStatusMessage, isVendorApproved, requireSubscribedVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { buildVendorActionsUsage, getVendorRecentLinksData } from "@/features/dashboard/server/dashboard-data"
import { VendorLinkWorkspace } from "@/features/dashboard/components/vendor-link-workspace"

export default async function VendorActionsPage() {
  const { vendorProfile, session, subscription } = await requireSubscribedVendorProfileAccess()

  const [contracts, checklists, recentLinks] = await Promise.all([
    prisma.contractTemplate.findMany({
      where: { vendorId: vendorProfile.id },
      orderBy: { name: "asc" },
    }),
    prisma.checklistTemplate.findMany({
      where: { vendorId: vendorProfile.id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
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
