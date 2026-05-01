import { redirect } from "next/navigation"
import { getTransactionByToken } from "@/features/client-flow/server/client-flow-data"
import { stripe } from "@/lib/integrations/stripe"
import { prisma } from "@/lib/db/prisma"

export default async function ClientKycReturnPage({ 
  params,
  searchParams
}: { 
  params: { token: string }
  searchParams: { session_id?: string }
}) {
  const transaction = await getTransactionByToken(params.token)
  
  if (!transaction) {
    redirect("/")
  }

  if (searchParams.session_id) {
    try {
      const session = await stripe.identity.verificationSessions.retrieve(searchParams.session_id, {
        stripeAccount: transaction.vendor?.stripeAccountId || undefined
      })

      if (session.status === 'verified') {
        // Upsert KYC Verification record
        await prisma.kycVerification.upsert({
          where: { transactionId: transaction.id },
          create: {
            transactionId: transaction.id,
            provider: "Stripe Identity",
            status: "VERIFIED",
            providerReference: session.id,
            verifiedAt: new Date()
          },
          update: {
            status: "VERIFIED",
            providerReference: session.id,
            verifiedAt: new Date()
          }
        })

        // Advance transaction status
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "KYC_VERIFIED" }
        })
        
        redirect(`/t/${params.token}/contract`)
      } else {
         await prisma.kycVerification.upsert({
          where: { transactionId: transaction.id },
          create: {
            transactionId: transaction.id,
            provider: "Stripe Identity",
            status: "FAILED",
            providerReference: session.id,
          },
          update: {
            status: "FAILED",
            providerReference: session.id,
          }
        })
      }
    } catch (e) {
      console.error("KYC Return Error", e)
    }
  }

  // If we reach here, verification failed or was incomplete. Redirect back to KYC start page.
  redirect(`/t/${params.token}/kyc?error=verification_failed`)
}
