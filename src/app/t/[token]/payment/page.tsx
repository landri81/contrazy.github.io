import { redirect } from "next/navigation"
import { TransactionLinkStatus } from "@prisma/client"

import { EmbeddedPaymentForm } from "@/features/client-flow/components/embedded-payment-form"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"

export default async function ClientPaymentPage(props: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>
}) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect("/")
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    redirect(`/t/${token}/cancelled`)
  }

  const state = validateClientStep(transaction, "payment")

  if (state.financeComplete) {
    redirect(`/t/${token}/complete`)
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">Payment</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Complete the payment to finalise this transaction.
        </p>
      </div>

      <EmbeddedPaymentForm
        token={token}
        amount={transaction.amount ?? 0}
        depositAmount={transaction.depositAmount ?? 0}
        currency={transaction.currency}
      />
    </div>
  )
}
