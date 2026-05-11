import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { ClientKycForm } from "@/features/client-flow/components/client-kyc-form"
import { ClientStripeIdentityForm } from "@/features/client-flow/components/client-stripe-identity-form"
import { getNextClientStep, getTransactionByToken, validateClientStep } from "@/features/client-flow/server/client-flow-data"
import { getKycProvider } from "@/features/subscriptions/server/feature-gates"
import { prisma } from "@/lib/db/prisma"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientKycPage(props: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  validateClientStep(transaction, "kyc")

  if (!transaction.requiresKyc) {
    redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/${getNextClientStep(transaction)}`))
  }

  const kycStatus = transaction.kycVerification?.status

  const subscription = await prisma.vendorSubscription.findUnique({
    where: { vendorId: transaction.vendorId },
  })
  const provider = getKycProvider(subscription)
  const isFailed = kycStatus === "FAILED"
  const nextStep = getNextClientStep(transaction)
  const t = await getTranslations("clientFlow.kycPage")

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("description")}</p>
      </div>

      {provider === "stripe_identity" ? (
        <ClientStripeIdentityForm
          token={token}
          failed={isFailed}
          currentStatus={kycStatus ?? null}
          nextStep={nextStep}
        />
      ) : (
        <ClientKycForm
          token={token}
          failed={isFailed}
          currentStatus={kycStatus ?? null}
          nextStep={nextStep}
        />
      )}
    </div>
  )
}
