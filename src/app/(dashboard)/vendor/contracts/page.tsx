import { getVendorStatusMessage, isVendorPreparationAllowed, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { ContractTemplateList } from "@/features/dashboard/components/contract-template-list"

export default async function VendorContractsPage() {
  const { vendorProfile } = await requireVendorProfileAccess()

  const templates = await prisma.contractTemplate.findMany({
    where: { vendorId: vendorProfile.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contract Templates</h1>
        <p className="text-muted-foreground mt-2">
          Manage the agreement language used in your transactions and add merge fields for customer or payment details.
        </p>
      </div>

      <ContractTemplateList
        initialTemplates={templates}
        canEdit={isVendorPreparationAllowed(vendorProfile)}
        blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
      />
    </div>
  )
}
