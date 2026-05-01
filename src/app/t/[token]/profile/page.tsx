import { redirect } from "next/navigation"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ClientProfileForm } from "@/features/client-flow/components/client-pages"

export default async function ClientProfilePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, 'profile')

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Your Details</h2>
        <p className="text-muted-foreground mt-1">
          Please provide your contact information to proceed.
        </p>
      </div>

      <ClientProfileForm 
        token={token} 
        initialData={transaction.clientProfile}
      />
    </div>
  )
}
