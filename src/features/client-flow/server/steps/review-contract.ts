import { persistReviewedContractSnapshot } from "@/features/contracts/server/contract-artifacts"
import {
  canRevisitClientStep,
  clientFlowTransactionInclude,
  getNextClientStep,
} from "@/features/client-flow/server/client-flow-data"
import type { ClientStepResult } from "@/features/client-flow/server/steps/submit-documents"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { markTransactionLinkOpened, type getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

/**
 * The contract step (shared, M10): the customer reviewed the populated agreement; its snapshot is kept for the
 * signature. Contrazy's page and the partner API's embedded checkout (which also checks the version read) call it.
 */

type ActiveLink = Extract<Awaited<ReturnType<typeof getClientLinkAccessContext>>, { state: "active" }>["link"]

export async function reviewClientContract(link: ActiveLink): Promise<ClientStepResult> {
  const transactionId = link.transaction.id
  const currentTransaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: clientFlowTransactionInclude,
  })

  if (!currentTransaction) {
    return { status: 404, body: { success: false, message: "Transaction not found" } }
  }

  if (!canRevisitClientStep(currentTransaction, "contract")) {
    return { status: 409, body: { success: false, message: "The agreement can no longer be changed after payment has started." } }
  }

  await markTransactionLinkOpened(prisma, { linkId: link.id, transactionId })

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: currentTransaction.status === "SIGNED" ? currentTransaction.status : "CONTRACT_GENERATED",
    },
  })

  await persistReviewedContractSnapshot(prisma, transactionId)

  await recordTransactionEvent(prisma, {
    transactionId,
    type: "CONTRACT_REVIEWED",
    title: "Agreement reviewed",
    detail: "The client reviewed the populated agreement.",
    dedupeKey: `event:contract-reviewed:${transactionId}`,
  })

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: clientFlowTransactionInclude,
  })

  if (!transaction) {
    return { status: 404, body: { success: false, message: "Transaction not found" } }
  }

  return { status: 200, body: { success: true, nextStep: getNextClientStep(transaction) } }
}
