import { redirect } from "next/navigation"
import { TransactionLinkStatus } from "@prisma/client"

import { ClientFlowShell } from "@/features/client-flow/components/client-flow-shell"
import { ClientLinkCancelledState } from "@/features/client-flow/components/client-link-cancelled-state"
import {
  canCancelClientFlow,
  getClientFlowState,
  getTransactionByToken,
  hasContractStep,
  type ClientFlowStep,
} from "@/features/client-flow/server/client-flow-data"

export default async function TokenLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect("/")
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    return (
      <ClientLinkCancelledState
        vendorName={transaction.vendor?.businessName ?? "Vendor"}
        reason={transaction.link.cancelReason}
      />
    )
  }

  const enabledSteps: ClientFlowStep[] = ["profile", "documents"]
  if (transaction.requiresKyc) enabledSteps.push("kyc")
  if (hasContractStep(transaction)) {
    enabledSteps.push("contract", "sign")
  }
  const shouldShowPaymentStep =
    Boolean(transaction.depositAmount && transaction.depositAmount > 0) ||
    Boolean(
      transaction.amount &&
        transaction.amount > 0 &&
        (transaction.paymentCollectionTiming === "AFTER_SIGNING" || transaction.servicePaymentRequestedAt)
    )

  if (shouldShowPaymentStep) {
    enabledSteps.push("payment")
  }
  enabledSteps.push("complete")

  const state = getClientFlowState(transaction)
  const completedSteps: ClientFlowStep[] = []
  if (state.hasProfile) completedSteps.push("profile")
  if (state.hasDocs) completedSteps.push("documents")
  if (state.hasKyc && transaction.requiresKyc) completedSteps.push("kyc")
  if (state.reviewedContract && hasContractStep(transaction)) completedSteps.push("contract")
  if (state.hasSignature && hasContractStep(transaction)) completedSteps.push("sign")
  if (shouldShowPaymentStep && state.financeComplete) completedSteps.push("payment")
  if (transaction.status === "COMPLETED" || state.financeComplete) completedSteps.push("complete")

  return (
    <ClientFlowShell
      vendorName={transaction.vendor?.businessName ?? "Vendor"}
      reference={transaction.reference}
      token={token}
      canCancel={canCancelClientFlow(transaction)}
      enabledSteps={enabledSteps}
      completedSteps={completedSteps}
    >
      {children}
    </ClientFlowShell>
  )
}
