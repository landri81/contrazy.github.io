import { redirect } from "next/navigation"

import { ClientSignForm } from "@/features/client-flow/components/client-sign-form"
import {
  getNextClientStep,
  getTransactionByToken,
  validateClientStep,
} from "@/features/client-flow/server/client-flow-data"

export default async function ClientSignPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const transaction = await getTransactionByToken(token)

  if (!transaction) {
    redirect("/")
  }

  validateClientStep(transaction, "sign")

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
          Final step — Signature
        </div>
        <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-foreground">
          Sign this agreement
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Choose how you would like to sign. Your signature confirms your acceptance of all terms in
          this agreement.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-white/80 px-4 py-3.5 shadow-sm backdrop-blur-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Agreement summary
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{vendorName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Reference: {reference}</p>
      </div>

      <ClientSignForm
        token={token}
        existingSignature={existingSignature}
        nextStepAfterSignature={nextStepAfterSignature}
      />
    </div>
  )
}
