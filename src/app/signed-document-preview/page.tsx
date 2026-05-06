import { notFound } from "next/navigation"
import { renderContractContent } from "@/features/contracts/server/contract-rendering"
import { prisma } from "@/lib/db/prisma"
import { SignedAgreementPreview } from "@/features/contracts/components/signed-agreement-preview"

function formatSignedAtLabel(date: Date, timezone: string | null | undefined) {
  const resolvedTimezone = timezone?.trim() || "UTC"

  try {
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone: resolvedTimezone,
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date)
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: resolvedTimezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date)
    return `${day} at ${time} (${resolvedTimezone})`
  } catch {
    return date.toISOString()
  }
}

export default async function SignedDocumentPreviewPage(props: {
  searchParams: Promise<{ transactionId?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const { transactionId } = await props.searchParams

  const transaction = transactionId
    ? await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          vendor: true,
          clientProfile: true,
          contractArtifact: true,
          contractTemplate: true,
          signatureRecord: true,
        },
      })
    : await prisma.transaction.findFirst({
        where: {
          signatureRecord: { is: { status: "SIGNED" } },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          vendor: true,
          clientProfile: true,
          contractArtifact: true,
          contractTemplate: true,
          signatureRecord: true,
        },
      })

  if (!transaction?.clientProfile || !transaction.signatureRecord) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Signed document preview</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            No signed transaction is available to preview yet. Create or complete a signed transaction,
            then open this route again with:
          </p>
          <code className="mt-4 block rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-100">
            /signed-document-preview?transactionId=&lt;transaction-id&gt;
          </code>
        </div>
      </div>
    )
  }

  const templateContent =
    transaction.contractArtifact?.templateContentSnapshot ??
    transaction.contractTemplate?.content ??
    ""
  const signedAt = transaction.signatureRecord.signedAt ?? new Date()
  const signedTimezone = transaction.contractArtifact?.signedTimezone ?? "UTC"
  const renderedHtml =
    transaction.contractArtifact?.renderedContentAfterSignature ??
    renderContractContent({
      templateContent,
      clientProfile: transaction.clientProfile,
      vendorName: transaction.vendor?.businessName,
      transactionReference: transaction.reference,
      amount: transaction.amount,
      depositAmount: transaction.depositAmount,
      signerName: transaction.signatureRecord.signerName ?? transaction.clientProfile.fullName ?? "Client",
      signedAt,
      signedTimezone,
    })
  const freshPdfPreviewHref = `/api/dev/signed-document-pdf?transactionId=${transaction.id}`
  const freshPdfDownloadHref = `${freshPdfPreviewHref}&download=1`

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6">
      <div className="mx-auto mb-5 flex max-w-6xl justify-end">
        <a
          href={freshPdfDownloadHref}
          className="inline-flex items-center rounded-full border border-slate-200 bg-[var(--contrazy-teal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
        >
          Download test PDF
        </a>
      </div>
      <SignedAgreementPreview
        title={null}
        vendorName={transaction.vendor?.businessName ?? "Vendor"}
        clientName={
          transaction.signatureRecord.signerName ??
          transaction.clientProfile.fullName ??
          "Client"
        }
        clientEmail={transaction.signatureRecord.signerEmail ?? transaction.clientProfile.email ?? ""}
        transactionReference={transaction.reference}
        amount={transaction.amount}
        depositAmount={transaction.depositAmount}
        currency={transaction.currency}
        signedAtLabel={formatSignedAtLabel(signedAt, signedTimezone)}
        signatureMethod={transaction.signatureRecord.method ?? "Electronic Signature"}
        ipAddress={transaction.signatureRecord.ipAddress}
        signatureImageUrl={
          transaction.contractArtifact?.signatureImageUrl ??
          transaction.signatureRecord.signatureDataUrl ??
          null
        }
        renderedHtml={renderedHtml}
      />
    </div>
  )
}
