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
    vendorName: transaction.vendor?.businessName ?? null,
    clientName: buildClientDisplayName(transaction.clientProfile) || null,
    reference: transaction.reference,
    amount: transaction.amount,
    depositAmount: transaction.depositAmount,
    currency: transaction.currency,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-lg border border-white bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-sm sm:p-6">
        <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          Review agreement
        </div>
        <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground">
          Read the agreement carefully
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Review all terms before signing. Tick the box at the bottom to confirm you have read
          and understood the agreement.
        </p>
      </div>

      <ContractReviewForm
        token={token}
        contentHtml={populatedContract}
        documentMeta={documentMeta}
      />
    </div>
  )
}
