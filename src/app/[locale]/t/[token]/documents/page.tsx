import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getNextClientStep, getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ClientUploadsForm } from "@/features/client-flow/components/client-uploads-form"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientDocumentsPage(props: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  validateClientStep(transaction, "documents")
  const t = await getTranslations("clientFlow.documents")

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      <ClientUploadsForm
        token={token}
        requirements={transaction.requirements}
        skipStep={getNextClientStep(transaction)}
      />
    </div>
  )
}
