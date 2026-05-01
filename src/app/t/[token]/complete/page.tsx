import { redirect } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getTransactionByToken } from "@/features/client-flow/server/client-flow-data"
import { stripe } from "@/lib/integrations/stripe"
import { prisma } from "@/lib/db/prisma"
import { sendTransactionCompletedEmail, sendVendorDepositAlert } from "@/lib/integrations/resend"

export default async function ClientCompletePage({ 
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

  // If returning from Stripe Checkout, verify and finalize the transaction status
  if (searchParams.session_id && transaction.status !== 'COMPLETED') {
    try {
      const session = await stripe.checkout.sessions.retrieve(searchParams.session_id, {
        stripeAccount: transaction.vendor?.stripeAccountId || undefined
      })

      if (session.payment_status === "paid" || session.status === "complete") {
        
        // Finalize standard payment record
        if (transaction.amount && transaction.amount > 0) {
          await prisma.payment.create({
            data: {
              transactionId: transaction.id,
              kind: "SERVICE_PAYMENT",
              status: "SUCCEEDED",
              amount: transaction.amount,
              currency: transaction.currency,
              stripeIntentId: session.payment_intent as string,
              processedAt: new Date()
            }
          })
        }

        // Finalize deposit authorization record
        if (transaction.depositAmount && transaction.depositAmount > 0) {
          await prisma.depositAuthorization.create({
            data: {
              transactionId: transaction.id,
              status: "AUTHORIZED",
              amount: transaction.depositAmount,
              currency: transaction.currency,
              stripeIntentId: session.payment_intent as string,
              authorizedAt: new Date()
            }
          })
        }

        // Mark complete
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: "COMPLETED" }
        })

        // Also update link timestamp
        await prisma.transactionLink.update({
          where: { transactionId: transaction.id },
          data: { completedAt: new Date() }
        })

        // Trigger emails
        if (transaction.clientProfile?.email && transaction.vendor?.businessName) {
          await sendTransactionCompletedEmail(
            transaction.clientProfile.email,
            transaction.clientProfile.fullName,
            transaction.vendor.businessName,
            transaction.reference
          )
        }

        if (transaction.depositAmount && transaction.depositAmount > 0 && transaction.vendor?.businessEmail && transaction.clientProfile?.fullName) {
          await sendVendorDepositAlert(
            transaction.vendor.businessEmail,
            transaction.vendor.businessName || "Vendor",
            transaction.clientProfile.fullName,
            transaction.depositAmount
          )
        }
      }
    } catch (e) {
      console.error("Complete verification error:", e)
    }
  }

  return (
    <div className="max-w-md mx-auto text-center space-y-6 py-12">
      <div className="flex justify-center">
        <div className="bg-green-100 p-4 rounded-full dark:bg-green-900/30">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">You&apos;re All Set!</h1>
        <p className="text-muted-foreground">
          Your transaction with {transaction.vendor?.businessName} has been successfully completed.
        </p>
      </div>

      <div className="pt-8">
        <p className="text-sm text-muted-foreground mb-4">
          A receipt and a copy of your signed agreement will be emailed to you shortly.
        </p>
        <Button variant="outline" asChild>
          <Link href="/">
            Return Home <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
