import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { ContractTemplateList } from "@/features/dashboard/components/contract-template-list"

export default async function VendorContractsPage() {
  const { dbUser } = await requireVendorAccess()

  const templates = await prisma.contractTemplate.findMany({
    where: { vendorId: dbUser.vendorProfile?.id },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contract Templates</h1>
        <p className="text-muted-foreground mt-2">
          Manage the terms and conditions templates used in your transactions. 
          Use placeholders like {'{{clientName}}'} to automatically insert client details.
        </p>
      </div>

      <ContractTemplateList initialTemplates={templates} vendorId={dbUser.vendorProfile?.id || ""} />
    </div>
  )
}
