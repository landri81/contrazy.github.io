import { redirect } from "next/navigation"
import {
  buildPopulatedContractContent,
  getNextClientStep,
  getTransactionByToken,
  validateClientStep,
} from "@/features/client-flow/server/client-flow-data"
import { ContractReviewForm } from "@/features/client-flow/components/contract-review-form"

export default async function ClientContractPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, 'contract')

  // Auto-populate the contract text if it exists
  if (!transaction.contractTemplate) {
    redirect(`/t/${token}/${getNextClientStep(transaction)}`)
  }

  const populatedContract = buildPopulatedContractContent(transaction)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Review Contract</h2>
        <p className="text-muted-foreground mt-1">
          Please review the terms of this transaction before proceeding.
        </p>
      </div>

      <ContractReviewForm 
        token={token} 
        content={populatedContract} 
      />
    </div>
  )
}
