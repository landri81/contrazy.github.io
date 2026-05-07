import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { ClientSignForm } from "@/features/client-flow/components/client-sign-form"
import {
  getNextClientStep,
  getTransactionByToken,
  validateClientStep,
} from "@/features/client-flow/server/client-flow-data"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export default async function ClientSignPage(props: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: rawLocale, token } = await props.params
  const locale = normalizeLocale(rawLocale)
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect(withLocalePath(locale, "/"))
  }

  validateClientStep(transaction, "sign")

  const t = await getTranslations("clientFlow.sign")
  const vendorName = transaction.vendor?.businessName ?? "Vendor"
  const reference = transaction.reference
  const signatureRecord = transaction.signatureRecord
  const existingSignature = signatureRecord
    ? {
        status: signatureRecord.status,
        isFinalized: Boolean(
          signatureRecord.status === "SIGNED" && transaction.contractArtifact?.signedPdfUrl
        ),
        signerName: signatureRecord.signerName,
        signerEmail: signatureRecord.signerEmail,
        method: signatureRecord.method,
        signatureDataUrl: signatureRecord.signatureDataUrl,
        typedValue: signatureRecord.typedValue,
        fontKey: signatureRecord.fontKey,
        signedAt: signatureRecord.signedAt?.toISOString() ?? null,
      }
    : null
  const nextStepAfterSignature = getNextClientStep(transaction)

  return (
    <div className="mx-auto max-w-lg space-y-4 sm:space-y-5">
      <div className="rounded-lg border border-white bg-white/80 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-sm">
        <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          {t("step")}
        </div>
        <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-white/80 px-4 py-3.5 shadow-sm backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("agreementSummary")}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{vendorName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("reference")} {reference}</p>
      </div>

      <ClientSignForm
        token={token}
        existingSignature={existingSignature}
        nextStepAfterSignature={nextStepAfterSignature}
      />
    </div>
  )
}
