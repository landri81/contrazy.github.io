import { redirect } from "next/navigation"
import { CheckCircle2, ChevronRight } from "lucide-react"
import { TransactionLinkStatus } from "@prisma/client"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "@/components/ui/button"
import { Link as LocalizedLink } from "@/i18n/navigation"
import { ClientProcessingCard } from "@/features/client-flow/components/client-processing-card"
import { getNextClientStep, getTransactionByToken } from "@/features/client-flow/server/client-flow-data"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import { cn } from "@/lib/utils"

export default async function ClientCompletePage(props: {
  params: Promise<{ locale: string; token: string }>
  searchParams: Promise<{ session_id?: string; stage?: string }>
}) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const searchParams = await props.searchParams
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/cancelled`))
  }

  const nextStep = getNextClientStep(transaction)
  const customerFlowComplete = nextStep === "complete"
  const transactionComplete = transaction.status === "COMPLETED"
  const signedPdfHref = resolveDocumentAssetUrl(transaction.contractArtifact?.signedPdfUrl, `${transaction.reference}-signed.pdf`)
  const businessName = transaction.vendor?.businessName ?? ""

  const t = await getTranslations("clientFlow.finish")

  if (!customerFlowComplete) {
    if (searchParams.session_id) {
      return (
        <div className="mx-auto max-w-lg space-y-6 py-12">
          <ClientProcessingCard
            title={t("processingTitle")}
            description={t("processingDescription")}
          />
        </div>
      )
    }

    redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/${nextStep}`))
  }

  return (
    <div className="max-w-md mx-auto text-center space-y-6 py-12">
      <div className="flex justify-center">
        <div className="bg-green-100 p-4 rounded-full dark:bg-green-900/30">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {transactionComplete ? t("allSet") : t("agreementCompleted")}
        </h1>
        <p className="text-muted-foreground">
          {transactionComplete
            ? t("allSetDescription", { businessName })
            : t("agreementCompletedDescription", { businessName })}
        </p>
      </div>

      <div className="pt-8">
        <p className="text-sm text-muted-foreground mb-4">
          {transactionComplete
            ? t("receiptInfo")
            : t("keepLink")}
        </p>
        {transaction.contractArtifact?.signedPdfUrl ? (
          <a
            href={signedPdfHref ?? transaction.contractArtifact.signedPdfUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "secondary" }), "mb-3 inline-flex w-full")}
          >
            {t("downloadSigned")}
          </a>
        ) : null}
        <LocalizedLink
          href="/"
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
        >
          {t("returnHome")} <ChevronRight className="ml-2 h-4 w-4" />
        </LocalizedLink>
      </div>
    </div>
  )
}
