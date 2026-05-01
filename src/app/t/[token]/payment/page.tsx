import { redirect } from "next/navigation"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { PaymentActionForm } from "@/features/client-flow/components/payment-action-form"

export default async function ClientPaymentPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, 'payment')

  const hasServicePayment = transaction.amount && transaction.amount > 0
  const hasDeposit = transaction.depositAmount && transaction.depositAmount > 0

  if (!hasServicePayment && !hasDeposit) {
    // If no payment is required, redirect to complete
    redirect(`/t/${token}/complete`)
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Payment & Deposit</h2>
        <p className="text-muted-foreground mt-1">
          Complete the financial requirements to finalize this transaction.
        </p>
      </div>

      <PaymentActionForm 
        token={token} 
        amount={transaction.amount || 0}
        depositAmount={transaction.depositAmount || 0}
        currency={transaction.currency}
      />
    </div>
  )
}
