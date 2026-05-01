import { redirect } from "next/navigation"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ClientUploadsForm } from "@/features/client-flow/components/client-uploads-form"

export default async function ClientDocumentsPage({ params }: { params: { token: string } }) {
  const transaction = await getTransactionByToken(params.token)
  
  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, 'documents')

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Required Uploads</h2>
        <p className="text-muted-foreground mt-1">
          Please upload the requested documents or photos below.
        </p>
      </div>

      <ClientUploadsForm 
        token={params.token} 
        requirements={transaction.requirements}
      />
    </div>
  )
}
