import { redirect } from "next/navigation"

import { ClientKycForm } from "@/features/client-flow/components/client-kyc-form"
import { ClientStripeIdentityForm } from "@/features/client-flow/components/client-stripe-identity-form"
import { getNextClientStep, getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { getKycProvider } from "@/features/subscriptions/server/feature-gates"
import { prisma } from "@/lib/db/prisma"

export default async function ClientKycPage(props: {
  params: Promise<{ token: string }>
}) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, "kyc")

  if (!transaction.requiresKyc) {
    redirect(`/t/${token}/${getNextClientStep(transaction)}`)
  }

  const kycStatus = transaction.kycVerification?.status

  if (kycStatus === "VERIFIED" || kycStatus === "PENDING") {
    redirect(`/t/${token}/${getNextClientStep(transaction)}`)
  }

  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId: transaction.vendorId },
  })
  const provider = getKycProvider(subscription)
  const isFailed = kycStatus === "FAILED"

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Identity Verification</h2>
        <p className="text-muted-foreground mt-1">
          For your security, we need to verify your identity before proceeding.
        </p>
      </div>

      {provider === "stripe_identity" ? (
        <ClientStripeIdentityForm token={token} failed={isFailed} />
      ) : (
        <ClientKycForm token={token} failed={isFailed} />
      )}
    </div>
  )
}
