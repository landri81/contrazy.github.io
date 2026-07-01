import { redirect } from "next/navigation"
import { TransactionReportType } from "@prisma/client"

import { ClientReportForm } from "@/features/client-flow/components/client-report-form"
import {
  getTransactionByToken,
  validateClientStep,
} from "@/features/client-flow/server/client-flow-data"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientCheckInPage(props: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  validateClientStep(transaction, "check-in")

  const checkInFields = transaction.reportFields.filter(
    (f) => f.reportType === TransactionReportType.CHECK_IN
  )

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-lg border border-white bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-sm sm:p-6">
        <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          Check-In Report
        </div>
        <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
          Complete the check-in
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Record the current condition, readings, and any requested files or photos before the service begins.
        </p>
      </div>

      <ClientReportForm
        token={token}
        reportType="CHECK_IN"
        fields={checkInFields}
        priorReport={null}
        priorFields={[]}
        nextStep="payment"
      />
    </div>
  )
}
