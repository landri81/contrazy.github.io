import { getVendorStatusMessage, isVendorApproved, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getVendorRecentLinksData } from "@/features/dashboard/server/dashboard-data"
import { VendorLinkWorkspace } from "@/features/dashboard/components/vendor-link-workspace"

export default async function VendorActionsPage() {
  const { vendorProfile, session } = await requireVendorProfileAccess()

  const [contracts, checklists, recentLinks] = await Promise.all([
    prisma.contractTemplate.findMany({
      where: { vendorId: vendorProfile.id },
      orderBy: { name: "asc" },
    }),
    prisma.checklistTemplate.findMany({
      where: { vendorId: vendorProfile.id },
      orderBy: { name: "asc" },
    }),
    getVendorRecentLinksData(session.user.email, 6),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Transaction</h1>
        <p className="text-muted-foreground mt-2">
          Generate a secure link to collect client details, signatures, and payments.
        </p>
      </div>

      <VendorLinkWorkspace
        contracts={contracts}
        checklists={checklists}
        initialLinks={recentLinks}
        hasStripe={vendorProfile.stripeConnectionStatus === "CONNECTED"}
        canLaunch={isVendorApproved(vendorProfile)}
        blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
      />
    </div>
  )
}
