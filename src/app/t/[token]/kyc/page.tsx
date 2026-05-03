import { redirect } from "next/navigation"
import { getNextClientStep, getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ClientKycForm } from "@/features/client-flow/components/client-kyc-form"

export default async function ClientKycPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, 'kyc')

  // If KYC is not required, auto-skip
  if (!transaction.requiresKyc) {
    redirect(`/t/${token}/${getNextClientStep(transaction)}`)
  }

  // Already verified or submitted for manual review → proceed
  const kycStatus = transaction.kycVerification?.status
  if (kycStatus === "VERIFIED" || kycStatus === "PENDING") {
    redirect(`/t/${token}/${getNextClientStep(transaction)}`)
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Identity Verification</h2>
        <p className="text-muted-foreground mt-1">
          For your security, we need to verify your identity before proceeding.
        </p>
      </div>

      <ClientKycForm token={token} />
    </div>
  )
}
