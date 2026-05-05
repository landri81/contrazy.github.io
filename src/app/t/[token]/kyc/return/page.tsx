import { redirect } from "next/navigation"
import { TransactionLinkStatus } from "@prisma/client"

import { getNextClientStep, getTransactionByToken } from "@/features/client-flow/server/client-flow-data"
import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"
import { stripe } from "@/lib/integrations/stripe"

export const dynamic = "force-dynamic"

function isNextRedirectError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
  )
}

export default async function ClientKycReturnPage(props: {
  params: Promise<{ token: string }>
}) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect("/")
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    redirect(`/t/${token}/cancelled`)
  }

  // Fetch the KycVerification record created when the session was started.
  const kycVerification = await prisma.kycVerification.findUnique({
    where: { transactionId: transaction.id },
  })

  // If the webhook already processed the result before the customer arrived,
  // act on the DB state directly without an additional Stripe API call.
  if (kycVerification?.status === "VERIFIED") {
    const freshTransaction = await getTransactionByToken(token)
    if (!freshTransaction) redirect("/")
    redirect(`/t/${token}/${getNextClientStep(freshTransaction)}`)
  }

  if (kycVerification?.status === "FAILED") {
    redirect(`/t/${token}/kyc?error=verification_failed`)
  }

  // Status is PENDING (or record is missing) — session just completed on Stripe's
  // side. Retrieve the result from the platform Stripe account using the session ID
  // stored at creation time.
  if (!kycVerification?.providerReference) {
    redirect(`/t/${token}/kyc?error=session_not_found`)
  }

  try {
    // Retrieve from the PLATFORM account (no Stripe-Account header).
    // The session was created on the platform account in the start route.
    const session = await stripe.identity.verificationSessions.retrieve(
      kycVerification.providerReference
    )

    if (session.status === "verified") {
      await prisma.$transaction(async (tx) => {
        // Read current status inside the transaction so the increment check is
        // consistent even if the webhook fires concurrently.
        const current = await tx.kycVerification.findUnique({
          where: { transactionId: transaction.id },
          select: { status: true },
        })

        await tx.kycVerification.update({
          where: { transactionId: transaction.id },
          data: {
            status: "VERIFIED",
            providerReference: session.id,
            verifiedAt: new Date(),
          },
        })

        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "KYC_VERIFIED" },
        })

        // Only count once: skip if this transaction's KYC was already VERIFIED
        // (guards against rare webhook + return-page concurrency).
        if (current?.status !== "VERIFIED") {
          await incrementVendorSubscriptionUsage(tx, transaction.vendorId, "kycVerificationsUsed")
        }

        await recordTransactionEvent(tx, {
          transactionId: transaction.id,
          type: "KYC_VERIFIED",
          title: "Identity verification completed",
          detail: "Stripe Identity confirmed the customer's identity.",
          dedupeKey: `event:kyc-verified:${transaction.id}`,
        })
      })

      const freshTransaction = await getTransactionByToken(token)
      if (!freshTransaction) redirect("/")
      redirect(`/t/${token}/${getNextClientStep(freshTransaction)}`)
    } else {
      // Session status is "requires_input", "processing", or "canceled".
      await prisma.$transaction(async (tx) => {
        await tx.kycVerification.update({
          where: { transactionId: transaction.id },
          data: {
            status: "FAILED",
            summary: session.last_error?.reason ?? session.status,
          },
        })

        await recordTransactionEvent(tx, {
          transactionId: transaction.id,
          type: "KYC_FAILED",
          title: "Identity verification failed",
          detail: session.last_error?.reason
            ? `Reason: ${session.last_error.reason}`
            : "The verification provider did not confirm the customer's identity.",
          dedupeKey: `event:kyc-failed:${transaction.id}:${session.id}`,
        })
      })
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }
    console.error("KYC Return Error:", error)
  }

  redirect(`/t/${token}/kyc?error=verification_failed`)
}
