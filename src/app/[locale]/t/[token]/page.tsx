import { redirect } from "next/navigation"
import { TransactionLinkStatus } from "@prisma/client"

import { getNextClientStep, getTransactionByToken } from "@/features/client-flow/server/client-flow-data"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function TokenIndexPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale: rawLocale, token } = await params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  if (transaction.link?.status === TransactionLinkStatus.CANCELLED) {
    redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/cancelled`))
  }

  redirect(withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/${getNextClientStep(transaction)}`))
}
