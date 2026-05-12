import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { ClientCustomFieldsForm } from "@/features/client-flow/components/client-custom-fields-form"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientDetailsPage(props: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  validateClientStep(transaction, "details")

  const t = await getTranslations("clientFlow.details")

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-lg border border-white bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-sm sm:p-6">
        <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
          {t("step")}
        </div>
        <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <ClientCustomFieldsForm token={token} fields={transaction.customFields} />
    </div>
  )
}
