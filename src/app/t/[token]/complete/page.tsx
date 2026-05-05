import { redirect } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, ChevronRight } from "lucide-react"
import { TransactionLinkStatus } from "@prisma/client"

import { buttonVariants } from "@/components/ui/button"
import { ClientProcessingCard } from "@/features/client-flow/components/client-processing-card"
import { getNextClientStep, getTransactionByToken } from "@/features/client-flow/server/client-flow-data"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import { cn } from "@/lib/utils"

export default async function ClientCompletePage(props: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ session_id?: string; stage?: string }>
}) {
  const { token } = await props.params
  const searchParams = await props.searchParams
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    redirect(`/t/${token}/cancelled`)
  }

  const nextStep = getNextClientStep(transaction)
  const customerFlowComplete = nextStep === "complete"
  const transactionComplete = transaction.status === "COMPLETED"
  const signedPdfHref = resolveDocumentAssetUrl(transaction.contractArtifact?.signedPdfUrl, `${transaction.reference}-signed.pdf`)

  if (!customerFlowComplete) {
    if (searchParams.session_id) {
      return (
        <div className="mx-auto max-w-lg space-y-6 py-12">
          <ClientProcessingCard
            title="Final confirmation in progress"
            description="We are confirming the last Stripe step before marking this transaction as complete."
          />
        </div>
      )
    }

    redirect(`/t/${token}/${nextStep}`)
  }

  return (
    <div className="max-w-md mx-auto text-center space-y-6 py-12">
      <div className="flex justify-center">
        <div className="bg-green-100 p-4 rounded-full dark:bg-green-900/30">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {transactionComplete ? "You're All Set!" : "Agreement Completed"}
        </h1>
        <p className="text-muted-foreground">
          {transactionComplete
            ? `Your transaction with ${transaction.vendor?.businessName} has been successfully completed.`
            : `Your agreement and required verification with ${transaction.vendor?.businessName} are complete. The vendor will request the service payment later if needed.`}
        </p>
      </div>

      <div className="pt-8">
        <p className="text-sm text-muted-foreground mb-4">
          {transactionComplete
            ? "A receipt and a copy of your signed agreement will be emailed to you shortly."
            : "Keep this secure link available. If the vendor triggers payment later, this same flow will reopen the payment step for you."}
        </p>
        {transaction.contractArtifact?.signedPdfUrl ? (
          <Link
            href={signedPdfHref ?? transaction.contractArtifact.signedPdfUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "secondary" }), "mb-3 inline-flex w-full")}
          >
            Download Signed Agreement
          </Link>
        ) : null}
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
        >
          Return Home <ChevronRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
