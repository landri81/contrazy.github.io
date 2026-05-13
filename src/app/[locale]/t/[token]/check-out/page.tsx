import { redirect } from "next/navigation"
import { TransactionReportType } from "@prisma/client"

import { ClientReportForm } from "@/features/client-flow/components/client-report-form"
import {
  getTransactionByToken,
  validateClientStep,
} from "@/features/client-flow/server/client-flow-data"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientCheckOutPage(props: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  validateClientStep(transaction, "check-out")

  const checkOutFields = transaction.reportFields.filter(
    (f) => f.reportType === TransactionReportType.CHECK_OUT
  )

  const checkInReport =
    transaction.reports.find((r) => r.type === TransactionReportType.CHECK_IN) ?? null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-lg border border-white bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-sm sm:p-6">
        <div className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
          Check-Out Report
        </div>
        <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
          Complete the check-out
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Record the return condition, final readings, and any changes since check-in. Upload at least one photo.
        </p>
      </div>

      <ClientReportForm
        token={token}
        reportType="CHECK_OUT"
        fields={checkOutFields}
        priorReport={checkInReport}
        nextStep="complete"
      />
    </div>
  )
}
