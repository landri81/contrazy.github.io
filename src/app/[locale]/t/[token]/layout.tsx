import { redirect } from "next/navigation"
import { TransactionLinkStatus } from "@prisma/client"

import { ClientFlowShell } from "@/features/client-flow/components/client-flow-shell"
import { ClientLinkCancelledState } from "@/features/client-flow/components/client-link-cancelled-state"
import {
  canCancelClientFlow,
  canRevisitClientStep,
  getClientFlowState,
  getNotRequiredSteps,
  getTransactionByToken,
  hasCheckInStep,
  hasCheckOutStep,
  hasCustomFieldStep,
  hasContractStep,
  hasDocumentsStep,
  isCheckInOutFlow,
  type ClientFlowStep,
} from "@/features/client-flow/server/client-flow-data"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function TokenLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale: rawLocale, token } = await params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    return (
      <ClientLinkCancelledState
        vendorName={transaction.vendor?.businessName ?? "Vendor"}
        reason={transaction.link.cancelReason}
      />
    )
  }

  const isCheckInOut = isCheckInOutFlow(transaction)

  const enabledSteps: ClientFlowStep[] = ["profile"]
  if (transaction.requiresKyc) enabledSteps.push("kyc")
  if (hasDocumentsStep(transaction)) enabledSteps.push("documents")
  if (hasCustomFieldStep(transaction)) enabledSteps.push("details")
  if (hasContractStep(transaction)) {
    enabledSteps.push("contract", "sign")
  }
  if (isCheckInOut && hasCheckInStep(transaction)) {
    enabledSteps.push("check-in")
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

  // check-out appears dynamically after vendor triggers it
  if (hasCheckOutStep(transaction) && transaction.checkOutRequestedAt) {
    enabledSteps.push("check-out")
  }

  // Partner bookings: switched-off steps are skipped and listed as "not required".
  const notRequiredSteps = getNotRequiredSteps(transaction, enabledSteps)

  const state = getClientFlowState(transaction)
  const completedSteps: ClientFlowStep[] = []
  if (state.hasProfile) completedSteps.push("profile")
  if (state.hasDocs && hasDocumentsStep(transaction)) completedSteps.push("documents")
  if (state.hasKyc && transaction.requiresKyc) completedSteps.push("kyc")
  if (state.hasCustomFields && hasCustomFieldStep(transaction)) completedSteps.push("details")
  if (state.reviewedContract && hasContractStep(transaction)) completedSteps.push("contract")
  if (state.hasSignature && hasContractStep(transaction)) completedSteps.push("sign")
  if (isCheckInOut && state.hasCheckIn && hasCheckInStep(transaction)) completedSteps.push("check-in")
  if (shouldShowPaymentStep && state.financeComplete) completedSteps.push("payment")
  if (transaction.status === "COMPLETED" || state.financeComplete) completedSteps.push("complete")
  if (hasCheckOutStep(transaction) && state.hasCheckOut) completedSteps.push("check-out")

  const revisitableSteps = completedSteps.filter((step) => canRevisitClientStep(transaction, step))

  return (
    <ClientFlowShell
      vendorName={transaction.vendor?.businessName ?? "Vendor"}
      reference={transaction.reference}
      token={token}
      canCancel={canCancelClientFlow(transaction)}
      enabledSteps={enabledSteps}
      notRequiredSteps={notRequiredSteps}
      completedSteps={completedSteps}
      revisitableSteps={revisitableSteps}
      businessLogoUrl={transaction.vendor?.businessLogoUrl}
    >
      {children}
    </ClientFlowShell>
  )
}
