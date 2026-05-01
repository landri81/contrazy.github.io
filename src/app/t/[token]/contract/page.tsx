import { redirect } from "next/navigation"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ContractReviewForm } from "@/features/client-flow/components/contract-review-form"

export default async function ClientContractPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, 'contract')

  // Auto-populate the contract text if it exists
  let populatedContract = ""
  if (transaction.contractTemplate) {
    populatedContract = transaction.contractTemplate.content
      .replace(/{{clientName}}/g, transaction.clientProfile?.fullName || "")
      .replace(/{{clientEmail}}/g, transaction.clientProfile?.email || "")
      .replace(/{{clientPhone}}/g, transaction.clientProfile?.phone || "")
      .replace(/{{clientCompany}}/g, transaction.clientProfile?.companyName || "")
      .replace(/{{vendorName}}/g, transaction.vendor?.businessName || "Vendor")
      .replace(/{{transactionReference}}/g, transaction.reference || "")
      .replace(/{{paymentAmount}}/g, transaction.amount ? (transaction.amount / 100).toFixed(2) : "0.00")
      .replace(/{{depositAmount}}/g, transaction.depositAmount ? (transaction.depositAmount / 100).toFixed(2) : "0.00")
  } else {
    // If no contract, skip to sign/payment
    redirect(`/t/${params.token}/payment`)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Review Contract</h2>
        <p className="text-muted-foreground mt-1">
          Please review the terms of this transaction before proceeding.
        </p>
      </div>

      <ContractReviewForm 
        token={params.token} 
        content={populatedContract} 
      />
    </div>
  )
}
