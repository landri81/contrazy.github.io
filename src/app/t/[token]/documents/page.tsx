import { redirect } from "next/navigation"
import { getNextClientStep, getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ClientUploadsForm } from "@/features/client-flow/components/client-uploads-form"

export default async function ClientDocumentsPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)
  
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
        token={token} 
        requirements={transaction.requirements}
        skipStep={getNextClientStep(transaction)}
      />
    </div>
  )
}
