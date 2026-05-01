import { redirect } from "next/navigation"

import { ClientFlowShell } from "@/features/client-flow/components/client-flow-shell"
import {
  getClientFlowState,
  getTransactionByToken,
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

  const enabledSteps: ClientFlowStep[] = ["profile", "documents"]
  if (transaction.requiresKyc) enabledSteps.push("kyc")
  if (transaction.contractTemplateId) {
    enabledSteps.push("contract", "sign")
  }
  enabledSteps.push("payment", "complete")

  const state = getClientFlowState(transaction)
  const completedSteps: ClientFlowStep[] = []
  if (state.hasProfile) completedSteps.push("profile")
  if (state.hasDocs) completedSteps.push("documents")
  if (state.hasKyc && transaction.requiresKyc) completedSteps.push("kyc")
  if (state.reviewedContract && transaction.contractTemplateId) completedSteps.push("contract")
  if (state.hasSignature && transaction.contractTemplateId) completedSteps.push("sign")
  if (state.financeComplete) completedSteps.push("payment")
  if (transaction.status === "COMPLETED") completedSteps.push("complete")

  return (
    <ClientFlowShell
      vendorName={transaction.vendor?.businessName ?? "Vendor"}
      reference={transaction.reference}
      enabledSteps={enabledSteps}
      completedSteps={completedSteps}
    >
      {children}
    </ClientFlowShell>
  )
}
