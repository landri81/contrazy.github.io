import { redirect } from "next/navigation"
import { getNextClientStep, getTransactionByToken } from "@/features/client-flow/server/client-flow-data"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { getConnectedAccountRequestOptions, stripe } from "@/lib/integrations/stripe"

export default async function ClientKycReturnPage(props: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ session_id?: string }>
}) {
  const { token } = await props.params
  const searchParams = await props.searchParams
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  if (searchParams.session_id) {
    try {
      const session = await stripe.identity.verificationSessions.retrieve(
        searchParams.session_id,
        {},
        getConnectedAccountRequestOptions(transaction.vendor?.stripeAccountId)
      )

      if (session.status === 'verified') {
        await prisma.$transaction(async (tx) => {
          await tx.kycVerification.upsert({
            where: { transactionId: transaction.id },
            create: {
              transactionId: transaction.id,
              provider: "Stripe Identity",
              status: "VERIFIED",
              providerReference: session.id,
              verifiedAt: new Date(),
            },
            update: {
              status: "VERIFIED",
              providerReference: session.id,
              verifiedAt: new Date(),
            },
          })

          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: "KYC_VERIFIED" },
          })

          await recordTransactionEvent(tx, {
            transactionId: transaction.id,
            type: "KYC_VERIFIED",
            title: "Identity verification completed",
            detail: "Stripe Identity confirmed the customer record.",
            dedupeKey: `event:kyc-verified:${transaction.id}`,
          })
        })

        const freshTransaction = await getTransactionByToken(token)

        if (!freshTransaction) {
          redirect("/")
        }

        redirect(`/t/${token}/${getNextClientStep(freshTransaction)}`)
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.kycVerification.upsert({
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
            },
          })

          await recordTransactionEvent(tx, {
            transactionId: transaction.id,
            type: "KYC_FAILED",
            title: "Identity verification failed",
            detail: "The verification provider did not confirm the customer record.",
            dedupeKey: `event:kyc-failed:${transaction.id}`,
          })
        })
      }
    } catch (e) {
      console.error("KYC Return Error", e)
    }
  }

  // If we reach here, verification failed or was incomplete. Redirect back to KYC start page.
  redirect(`/t/${token}/kyc?error=verification_failed`)
}
