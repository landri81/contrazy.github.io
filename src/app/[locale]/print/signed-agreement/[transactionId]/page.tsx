import { notFound } from "next/navigation"

import { SignedAgreementPreview } from "@/features/contracts/components/signed-agreement-preview"
import { renderContractContent } from "@/features/contracts/server/contract-rendering"
import { verifySignedDocumentRenderToken } from "@/features/contracts/server/signed-document-render-auth"
import { prisma } from "@/lib/db/prisma"
import { getSiteUrl } from "@/lib/site-url"

export const dynamic = "force-dynamic"
export const maxDuration = 60

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

export default async function SignedAgreementPrintPage(props: {
  params: Promise<{ transactionId: string }>
  searchParams: Promise<{ sig?: string }>
}) {
  const { transactionId } = await props.params
  const { sig } = await props.searchParams

  if (!verifySignedDocumentRenderToken(transactionId, sig)) {
    notFound()
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      vendor: true,
      clientProfile: true,
      contractArtifact: true,
      contractTemplate: true,
      signatureRecord: true,
    },
  })

  if (!transaction?.clientProfile || !transaction.signatureRecord) {
    notFound()
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

  return (
    <main className="bg-white px-10 py-10">
      <div className="mx-auto max-w-[1120px]">
        <SignedAgreementPreview
          title={
            transaction.contractArtifact?.sourceTemplateName ??
            transaction.contractTemplate?.name ??
            transaction.title
          }
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
          brandIconSrc={`${getSiteUrl().replace(/\/$/, "")}/logo/favicon-contrazy-64.png`}
          presentation="plain"
          renderedHtml={renderedHtml}
        />
      </div>
    </main>
  )
}
