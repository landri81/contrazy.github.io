import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { ClientProfileForm } from "@/features/client-flow/components/client-pages"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientProfilePage(props: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  validateClientStep(transaction, "profile")

  const t = await getTranslations("clientFlow.profile")

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-lg border border-white bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-sm sm:p-6">
        <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {t("step")}
        </div>
        <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <ClientProfileForm
        token={token}
        initialData={transaction.clientProfile}
        requireCompany={transaction.requireClientCompany}
      />
    </div>
  )
}
