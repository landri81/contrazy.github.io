import { redirect } from "next/navigation"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ClientProcessingCard } from "@/features/client-flow/components/client-processing-card"
import { PaymentActionForm } from "@/features/client-flow/components/payment-action-form"

export default async function ClientPaymentPage(props: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ session_id?: string; stage?: string }>
}) {
  const { token } = await props.params
  const searchParams = await props.searchParams
  const transaction = await getTransactionByToken(token)
  
  if (!transaction) {
    redirect("/")
  }

  const state = validateClientStep(transaction, 'payment')

  if (state.financeComplete) {
    redirect(`/t/${token}/complete`)
  }

  const pendingConfirmation =
    Boolean(searchParams.session_id) &&
    Boolean(searchParams.stage) &&
    searchParams.stage === state.nextFinanceStage
  const nextStage = state.nextFinanceStage === "deposit_authorization" ? "deposit_authorization" : "service_payment"

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Payment & Deposit</h2>
        <p className="text-muted-foreground mt-1">
          Complete the financial requirements to finalize this transaction.
        </p>
      </div>

      {pendingConfirmation ? (
        <ClientProcessingCard
          title="Confirming your Stripe step"
          description="Your payment or deposit authorization is being confirmed. This page refreshes automatically."
        />
      ) : null}

      <PaymentActionForm 
        token={token} 
        amount={transaction.amount || 0}
        depositAmount={transaction.depositAmount || 0}
        currency={transaction.currency}
        nextStage={nextStage}
        pendingConfirmation={pendingConfirmation}
      />
    </div>
  )
}
