import { redirect } from "next/navigation"
import { TransactionLinkStatus } from "@prisma/client"
import { getTranslations } from "next-intl/server"

import { hasSecuredCard, isCardSecurityRequired } from "@/features/card-security/card-security-state"
import { CardConsentGate } from "@/features/card-security/components/card-consent-gate"
import { CardSecurityForm } from "@/features/card-security/components/card-security-form"
import { ConsentPartiesMissingError } from "@/features/card-security/consent-texts"
import { consentTextFor, findCardConsent } from "@/features/card-security/server/card-security"
import { EmbeddedPaymentForm } from "@/features/client-flow/components/embedded-payment-form"
import { getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { getNextFinanceStage, type FinanceTransaction } from "@/features/transactions/server/transaction-finance"
import { prisma } from "@/lib/db/prisma"
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
  const paymentForm = (
    <EmbeddedPaymentForm
      token={token}
      amount={transaction.amount ?? 0}
      depositAmount={transaction.depositAmount ?? 0}
      currency={transaction.currency}
    />
  )

  // Card security (C5): consent first, then the card is saved with the rental payment or on its own.
  if (!isCardSecurityRequired(transaction) || hasSecuredCard(transaction)) {
    return (
      <div className="mx-auto max-w-lg space-y-4 sm:space-y-6">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t("description")}</p>
        </div>
        {paymentForm}
      </div>
    )
  }

  const tCard = await getTranslations("clientFlow.cardSecurity")
  const cardOnly = getNextFinanceStage(transaction as FinanceTransaction) === "card_security"
  let consentText: ReturnType<typeof consentTextFor> | null = null

  try {
    consentText = consentTextFor({ vendor: transaction.vendor! })
  } catch (error) {
    if (!(error instanceof ConsentPartiesMissingError)) throw error
  }

  const consentGiven = Boolean(await findCardConsent(prisma, transaction.id))

  return (
    <div className="mx-auto max-w-lg space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold sm:text-2xl">{cardOnly ? tCard("title") : t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{cardOnly ? tCard("description") : tCard("paymentDescription")}</p>
      </div>

      {consentText ? (
        <CardConsentGate
          token={token}
          consentGiven={consentGiven}
          textFr={consentText.fr}
          textEn={consentText.en}
          showTranslation={locale !== "fr"}
        >
          {cardOnly ? <CardSecurityForm token={token} /> : paymentForm}
        </CardConsentGate>
      ) : (
        <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {tCard("vendorIncomplete")}
        </p>
      )}
    </div>
  )
}
