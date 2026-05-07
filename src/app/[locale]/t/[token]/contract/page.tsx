import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import {
  buildPopulatedContractContent,
  getNextClientStep,
  getTransactionByToken,
  hasContractStep,
  validateClientStep,
} from "@/features/client-flow/server/client-flow-data"
import { buildClientDisplayName } from "@/features/contracts/server/contract-rendering"
import { ContractReviewForm } from "@/features/client-flow/components/contract-review-form"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientContractPage(props: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  validateClientStep(transaction, "contract")

  if (!hasContractStep(transaction)) {
    redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/${getNextClientStep(transaction)}`))
  }

  const populatedContract = buildPopulatedContractContent(transaction)
  const t = await getTranslations("clientFlow.contract")

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
          {t("eyebrow")}
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {t("description")}
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
