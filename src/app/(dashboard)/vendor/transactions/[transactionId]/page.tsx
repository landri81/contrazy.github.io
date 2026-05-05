import { requireSubscribedVendorAccess } from "@/lib/auth/guards"
import { isAdminRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/db/prisma"
import { buildVendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import { remainingQrCodes } from "@/features/subscriptions/server/feature-gates"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import { notFound } from "next/navigation"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DepositControlCard } from "@/features/dashboard/components/deposit-control-card"
import { KycReviewCard } from "@/features/dashboard/components/kyc-review-card"
import { PaymentLinkManagementActions } from "@/features/dashboard/components/payment-link-management-actions"
import { ServicePaymentRequestCard } from "@/features/dashboard/components/service-payment-request-card"
import { StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import { ContractDocument } from "@/features/contracts/components/contract-document"

export const dynamic = "force-dynamic"

export default async function VendorTransactionDetailPage(props: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await props.params
  const { session, dbUser, subscription } = await requireSubscribedVendorAccess()
  const isAdmin = isAdminRole(session.user.role)

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: transactionId,
    },
    include: {
      vendor: true,
      clientProfile: true,
      contractTemplate: true,
      link: true,
      requirements: true,
      documents: true,
      payments: true,
      depositAuthorization: true,
      signatureRecord: true,
      contractArtifact: true,
      kycVerification: true,
      events: {
        orderBy: { occurredAt: "asc" },
      },
    }
  })

  if (!transaction) {
    notFound()
  }

  if (!isAdmin) {
    const currentVendorUserId = dbUser?.id
    const transactionOwnerUserId = transaction.vendor?.userId

    if (!currentVendorUserId || transactionOwnerUserId !== currentVendorUserId) {
      notFound()
    }
  }

  const shareLink = transaction.link ? `${getAppBaseUrl()}/t/${transaction.link.token}` : null
  const signedPdfHref = resolveDocumentAssetUrl(transaction.contractArtifact?.signedPdfUrl, `${transaction.reference}-signed.pdf`)
  const servicePaymentAlreadyCollected = transaction.payments.some(
    (payment) => payment.kind === "SERVICE_PAYMENT" && (payment.status === "SUCCEEDED" || payment.status === "CAPTURED")
  )
  const linkRecord = transaction.link
    ? buildVendorLinkRecord({
        id: transaction.id,
        reference: transaction.reference,
        title: transaction.title,
        kind: transaction.kind,
        amount: transaction.amount,
        depositAmount: transaction.depositAmount,
        currency: transaction.currency,
        notes: transaction.notes,
        updatedAt: transaction.updatedAt,
        clientProfile: transaction.clientProfile
          ? {
              fullName: transaction.clientProfile.fullName,
              email: transaction.clientProfile.email,
            }
          : null,
        link: transaction.link,
      }, { qrRemaining: remainingQrCodes(subscription) })
    : null

  return (
    <div className="space-y-6">
      <div className="flex mb-4 bg-white p-4 rounded-md shadow-sm items-center justify-between">
        <div >
          <h1 className="text-3xl font-bold tracking-tight">{transaction.title}</h1>
          <p className="text-muted-foreground mt-2">
            Reference: {transaction.reference}
          </p>
        </div>
        <Badge variant={transaction.status === "COMPLETED" ? "default" : "secondary"}>
          {transaction.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {transaction.clientProfile?.fullName || "Pending"}
            </div>
            {transaction.clientProfile?.email && (
              <div className="text-xs text-muted-foreground truncate">
                {transaction.clientProfile.email}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {transaction.payments.find(p => p.kind === "SERVICE_PAYMENT")?.status || (transaction.amount ? "Pending" : "N/A")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deposit Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {transaction.depositAuthorization?.status || (transaction.depositAmount ? "Pending" : "None")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Docs Uploaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {transaction.documents.length} / {transaction.requirements.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {transaction.depositAuthorization && (
        <DepositControlCard
          transactionId={transaction.id}
          depositStatus={transaction.depositAuthorization.status}
          transactionStatus={transaction.status}
          amount={transaction.depositAuthorization.amount}
          currency={transaction.depositAuthorization.currency}
        />
      )}

      {transaction.paymentCollectionTiming === "AFTER_SERVICE" && transaction.amount ? (
        <ServicePaymentRequestCard
          transactionId={transaction.id}
          amount={transaction.amount}
          currency={transaction.currency}
          customerCompletedAt={transaction.customerCompletedAt?.toISOString() ?? null}
          servicePaymentRequestedAt={transaction.servicePaymentRequestedAt?.toISOString() ?? null}
          paymentAlreadyCollected={servicePaymentAlreadyCollected}
        />
      ) : null}

      {transaction.link ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Client access</CardTitle>
                <CardDescription>Reuse the secure link, QR code, or cancellation controls for this transaction.</CardDescription>
              </div>
              {linkRecord ? (
                <StatusBadge tone={getStatusTone(linkRecord.status)}>
                  {linkRecord.status}
                </StatusBadge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Customer link</p>
              <Link
                href={shareLink ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex cursor-pointer items-center text-(--contrazy-teal) hover:underline"
              >
                Open secure client flow
              </Link>
              <p className="mt-2 text-xs">Reference: {transaction.reference}</p>
              {linkRecord?.cancelReason ? (
                <p className="mt-2 text-xs text-destructive">
                  Cancelled: {linkRecord.cancelReason}
                  {linkRecord.cancelledAtLabel ? ` • ${linkRecord.cancelledAtLabel}` : ""}
                </p>
              ) : null}
            </div>
            {linkRecord?.qrCodeSvg ? (
              <div
                className="flex w-fit items-center justify-center rounded-lg border bg-white p-4 [&_svg]:block [&_svg]:h-44 [&_svg]:w-44"
                dangerouslySetInnerHTML={{ __html: linkRecord.qrCodeSvg }}
              />
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">No QR generated yet</p>
                <p className="mt-1">
                  {linkRecord?.canGenerateQr
                    ? "Generate a QR code when you want to share this transaction in person."
                    : linkRecord?.qrUnavailableReason ?? "QR is not available for this link state."}
                </p>
              </div>
            )}
            {linkRecord ? <PaymentLinkManagementActions record={linkRecord} variant="detail" /> : null}
          </CardContent>
        </Card>
      ) : null}

      {transaction.requiresKyc && transaction.kycVerification && (
        <KycReviewCard
          transactionId={transaction.id}
          kyc={transaction.kycVerification}
        />
      )}

      {transaction.contractTemplateId ? (
        <Card>
          <CardHeader>
            <CardTitle>Agreement artifact</CardTitle>
            <CardDescription>Review the snapshotted agreement and the immutable signed PDF for this transaction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Snapshot</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {transaction.contractArtifact?.sourceTemplateName ?? transaction.contractTemplate?.name ?? "Attached"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transaction.contractArtifact?.generatedAt
                    ? `Created ${transaction.contractArtifact.generatedAt.toLocaleString()}`
                    : "No transaction snapshot recorded yet."}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Review</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {transaction.contractArtifact?.reviewCompletedAt ? "Reviewed" : "Pending"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transaction.contractArtifact?.reviewCompletedAt
                    ? transaction.contractArtifact.reviewCompletedAt.toLocaleString()
                    : "The client has not completed the review checkpoint yet."}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Signed PDF</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {transaction.contractArtifact?.signedPdfUrl ? "Generated" : "Pending"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transaction.contractArtifact?.signedAt
                    ? transaction.contractArtifact.signedAt.toLocaleString()
                    : "The final PDF is created immediately after the client signs."}
                </p>
              </div>
            </div>

            {transaction.contractArtifact?.renderedContentBeforeSignature ? (
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="mb-3 text-sm font-medium text-foreground">Agreement snapshot</p>
                <div className="max-h-80 overflow-y-auto rounded-md border bg-white p-4">
                  <ContractDocument html={transaction.contractArtifact.renderedContentBeforeSignature} />
                </div>
              </div>
            ) : null}

            {transaction.contractArtifact?.signedPdfUrl ? (
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">Signed agreement</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <Link
                    href={signedPdfHref ?? transaction.contractArtifact.signedPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex cursor-pointer items-center text-(--contrazy-teal) hover:underline"
                  >
                    Download signed PDF
                  </Link>
                  {transaction.contractArtifact.signedPdfHash ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      SHA-256: {transaction.contractArtifact.signedPdfHash.slice(0, 16)}...
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {transaction.requirements.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Collected requirements</CardTitle>
            <CardDescription>Review the uploaded files and text responses attached to this transaction.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {transaction.requirements.map((requirement) => {
              const response = transaction.documents.find((document) => document.requirementId === requirement.id)

              return (
                <div key={requirement.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{requirement.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {requirement.type}
                        {requirement.required ? " · required" : " · optional"}
                      </p>
                      {requirement.instructions ? (
                        <p className="mt-2 text-sm text-muted-foreground">{requirement.instructions}</p>
                      ) : null}
                    </div>
                    <StatusBadge tone={response ? "success" : "warning"}>
                      {response ? "Submitted" : "Pending"}
                    </StatusBadge>
                  </div>

                  {response ? (
                    response.assetUrl ? (
                      <Link
                        href={resolveDocumentAssetUrl(response.assetUrl, response.fileName) ?? response.assetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center text-sm text-(--contrazy-teal) hover:underline"
                      >
                        {response.fileName ?? "Download uploaded file"}
                      </Link>
                    ) : response.textValue ? (
                      <div className="mt-3 rounded-md border bg-white p-3 text-sm text-foreground">
                        {response.textValue}
                      </div>
                    ) : null
                  ) : null}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Activity log for this transaction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transaction.events.length > 0 ? (
              transaction.events.map((event) => (
                <div key={event.id} className="flex gap-4">
                  <div className="w-28 shrink-0 text-sm text-muted-foreground">
                    {event.occurredAt.toLocaleDateString()}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>{event.title}</div>
                    {event.detail ? <div className="text-muted-foreground">{event.detail}</div> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex gap-4">
                <div className="w-28 shrink-0 text-sm text-muted-foreground">
                  {transaction.createdAt.toLocaleDateString()}
                </div>
                <div className="text-sm">Transaction created</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
