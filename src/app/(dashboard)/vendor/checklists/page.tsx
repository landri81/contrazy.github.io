import { getVendorStatusMessage, isVendorPreparationAllowed, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { ChecklistTemplateList } from "@/features/dashboard/components/checklist-template-list"

export default async function VendorChecklistsPage() {
  const { vendorProfile } = await requireVendorProfileAccess()

  const templates = await prisma.checklistTemplate.findMany({
    where: { vendorId: vendorProfile.id },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' }
      }
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Requirement Checklists</h1>
        <p className="text-muted-foreground mt-2">
          Create templates for the documents or photos clients must upload during a transaction.
        </p>
      </div>

      <ChecklistTemplateList
        initialTemplates={templates}
        canEdit={isVendorPreparationAllowed(vendorProfile)}
        blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
      />
    </div>
  )
}
