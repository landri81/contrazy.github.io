import { redirect } from "next/navigation"
import {
  buildPopulatedContractContent,
  getNextClientStep,
  getTransactionByToken,
  hasContractStep,
  validateClientStep,
} from "@/features/client-flow/server/client-flow-data"
import { buildClientDisplayName } from "@/features/contracts/server/contract-rendering"
import { ContractReviewForm } from "@/features/client-flow/components/contract-review-form"

export default async function ClientContractPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, "contract")

  if (!hasContractStep(transaction)) {
    redirect(`/t/${token}/${getNextClientStep(transaction)}`)
  }

  const populatedContract = buildPopulatedContractContent(transaction)

  const documentMeta = {
    title:
      transaction.contractArtifact?.sourceTemplateName ??
      transaction.contractTemplate?.name ??
      transaction.title,
    vendorName: transaction.vendor?.businessName ?? null,
    clientName: buildClientDisplayName(transaction.clientProfile) || null,
    reference: transaction.reference,
    amount: transaction.amount,
    depositAmount: transaction.depositAmount,
    currency: transaction.currency,
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="flex flex-col items-center text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Review agreement
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
          Read the agreement carefully
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Review all terms before signing. Tick the box at the bottom to confirm you have read
          and understood the agreement.
        </p>
      </section>

      <ContractReviewForm
        token={token}
        contentHtml={populatedContract}
        documentMeta={documentMeta}
      />
    </div>
  )
}
