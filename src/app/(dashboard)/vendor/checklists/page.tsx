import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { ChecklistTemplateList } from "@/features/dashboard/components/checklist-template-list"

export default async function VendorChecklistsPage() {
  const { dbUser } = await requireVendorAccess()

  const templates = await prisma.checklistTemplate.findMany({
    where: { vendorId: dbUser.vendorProfile?.id },
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

      <ChecklistTemplateList initialTemplates={templates} vendorId={dbUser.vendorProfile?.id || ""} />
    </div>
  )
}
