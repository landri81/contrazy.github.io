import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { TransactionCreationForm } from "@/features/dashboard/components/transaction-creation-form"

export default async function VendorActionsPage() {
  const { dbUser } = await requireVendorAccess()

  const contracts = await prisma.contractTemplate.findMany({
    where: { vendorId: dbUser.vendorProfile?.id },
    orderBy: { name: 'asc' }
  })

  const checklists = await prisma.checklistTemplate.findMany({
    where: { vendorId: dbUser.vendorProfile?.id },
    orderBy: { name: 'asc' }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Transaction</h1>
        <p className="text-muted-foreground mt-2">
          Generate a secure link to collect client details, signatures, and payments.
        </p>
      </div>

      <div className="max-w-2xl">
        <TransactionCreationForm 
          contracts={contracts} 
          checklists={checklists} 
          hasStripe={dbUser.vendorProfile?.stripeConnectionStatus === 'CONNECTED'} 
        />
      </div>
    </div>
  )
}
