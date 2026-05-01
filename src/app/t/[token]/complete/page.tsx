import { redirect } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { ClientProcessingCard } from "@/features/client-flow/components/client-processing-card"
import { getNextClientStep, getTransactionByToken } from "@/features/client-flow/server/client-flow-data"
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

  if (transaction.status !== "COMPLETED") {
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

    redirect(`/t/${token}/${getNextClientStep(transaction)}`)
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
