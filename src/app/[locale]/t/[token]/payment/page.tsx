import { redirect } from "next/navigation"
import { TransactionLinkStatus } from "@prisma/client"
import { getTranslations } from "next-intl/server"

import { EmbeddedPaymentForm } from "@/features/client-flow/components/embedded-payment-form"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientPaymentPage(props: {
  params: Promise<{ locale: string; token: string }>
  searchParams: Promise<{ payment_intent?: string; redirect_status?: string }>
}) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/cancelled`))
  }

  const state = validateClientStep(transaction, "payment")

  if (state.financeComplete) {
    redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/complete`))
  }

  const t = await getTranslations("clientFlow.payment")

  return (
    <div className="mx-auto max-w-lg space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {t("description")}
        </p>
      </div>

      <EmbeddedPaymentForm
        token={token}
        amount={transaction.amount ?? 0}
        depositAmount={transaction.depositAmount ?? 0}
        currency={transaction.currency}
      />
    </div>
  )
}
