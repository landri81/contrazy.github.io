import {
  getVendorStatusMessage,
  isVendorApproved,
  requireSubscribedVendorAccess,
} from "@/lib/auth/guards"
import { isAdminRole } from "@/lib/auth/roles"
import { prisma } from "@/lib/db/prisma"
import {
  buildVendorActionsUsage,
  buildVendorLinkRecord,
  getVendorCreateLinkDialogData,
} from "@/features/dashboard/server/dashboard-data"
import { remainingQrCodes } from "@/features/subscriptions/server/feature-gates"
import { resolveDocumentAssetUrl } from "@/lib/integrations/cloudinary-assets"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DepositControlCard } from "@/features/dashboard/components/deposit-control-card"
import { KycReviewCard } from "@/features/dashboard/components/kyc-review-card"
import { PaymentLinkManagementActions } from "@/features/dashboard/components/payment-link-management-actions"
import { RecreateTransactionAction } from "@/features/dashboard/components/recreate-transaction-action"
import { RequestCheckoutCard } from "@/features/dashboard/components/request-checkout-card"
import { ServicePaymentRequestCard } from "@/features/dashboard/components/service-payment-request-card"
import { StatusBadge } from "@/features/dashboard/components/dashboard-ui"
import { getStatusTone } from "@/features/dashboard/lib/status-tone"
import { ContractDocument } from "@/features/contracts/components/contract-document"
import { buildTransactionCreationInitialValues } from "@/features/transactions/server/transaction-recreation"

export const dynamic = "force-dynamic"

export default async function VendorTransactionDetailPage(props: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await props.params
  const t = await getTranslations("dashboard.vendor.transactionDetailPage")
  const sharedT = await getTranslations("dashboard.shared")

  const transactionStatusMap: Record<string, string> = {
    DRAFT: t("transactionStatus.DRAFT"),
    LINK_SENT: t("transactionStatus.LINK_SENT"),
    CUSTOMER_STARTED: t("transactionStatus.CUSTOMER_STARTED"),
    DOCS_SUBMITTED: t("transactionStatus.DOCS_SUBMITTED"),
    KYC_VERIFIED: t("transactionStatus.KYC_VERIFIED"),
    CONTRACT_GENERATED: t("transactionStatus.CONTRACT_GENERATED"),
    SIGNED: t("transactionStatus.SIGNED"),
    PAYMENT_AUTHORIZED: t("transactionStatus.PAYMENT_AUTHORIZED"),
    COMPLETED: t("transactionStatus.COMPLETED"),
    CANCELLED: t("transactionStatus.CANCELLED"),
    DISPUTED: t("transactionStatus.DISPUTED"),
  }

  const paymentStatusMap: Record<string, string> = {
    PENDING: t("paymentStatus.PENDING"),
    AUTHORIZED: t("paymentStatus.AUTHORIZED"),
    SUCCEEDED: t("paymentStatus.SUCCEEDED"),
    CAPTURED: t("paymentStatus.CAPTURED"),
    RELEASED: t("paymentStatus.RELEASED"),
    FAILED: t("paymentStatus.FAILED"),
    CANCELLED: t("paymentStatus.CANCELLED"),
  }

  const linkStatusMap: Record<string, string> = {
    ACTIVE: t("linkStatus.ACTIVE"),
    PROCESSING: t("linkStatus.PROCESSING"),
    COMPLETED: t("linkStatus.COMPLETED"),
    CANCELLED: t("linkStatus.CANCELLED"),
  }

  const eventTitleMap: Record<string, string> = {
    LINK_CREATED: t("eventTitles.LINK_CREATED"),
    TRANSACTION_RECREATED: t("eventTitles.TRANSACTION_RECREATED"),
    LINK_OPENED: t("eventTitles.LINK_OPENED"),
    LINK_UPDATED: t("eventTitles.LINK_UPDATED"),
    LINK_CANCELLED: t("eventTitles.LINK_CANCELLED"),
    CONTRACT_SNAPSHOT_CREATED: t("eventTitles.CONTRACT_SNAPSHOT_CREATED"),
    PROFILE_SUBMITTED: t("eventTitles.PROFILE_SUBMITTED"),
    DOCUMENTS_SUBMITTED: t("eventTitles.DOCUMENTS_SUBMITTED"),
    CUSTOM_FIELDS_SUBMITTED: t("eventTitles.CUSTOM_FIELDS_SUBMITTED"),
    KYC_STARTED: t("eventTitles.KYC_STARTED"),
    KYC_VERIFIED: t("eventTitles.KYC_VERIFIED"),
    KYC_FAILED: t("eventTitles.KYC_FAILED"),
    CONTRACT_REVIEWED: t("eventTitles.CONTRACT_REVIEWED"),
    SIGNATURE_COMPLETED: t("eventTitles.SIGNATURE_COMPLETED"),
    SIGNED_PDF_GENERATED: t("eventTitles.SIGNED_PDF_GENERATED"),
    PAYMENT_SESSION_CREATED: t("eventTitles.PAYMENT_SESSION_CREATED"),
    SERVICE_PAYMENT_REQUESTED: t("eventTitles.SERVICE_PAYMENT_REQUESTED"),
    SERVICE_PAYMENT_SUCCEEDED: t("eventTitles.SERVICE_PAYMENT_SUCCEEDED"),
    DEPOSIT_AUTHORIZED: t("eventTitles.DEPOSIT_AUTHORIZED"),
    DEPOSIT_CAPTURED: t("eventTitles.DEPOSIT_CAPTURED"),
    DEPOSIT_RELEASED: t("eventTitles.DEPOSIT_RELEASED"),
    DISPUTE_OPENED: t("eventTitles.DISPUTE_OPENED"),
    TRANSACTION_CANCELLED: t("eventTitles.TRANSACTION_CANCELLED"),
    COMPLETED: t("eventTitles.COMPLETED"),
    EMAIL_SENT: t("eventTitles.EMAIL_SENT"),
    WEBHOOK_PROCESSED: t("eventTitles.WEBHOOK_PROCESSED"),
    CHECK_IN_SUBMITTED: t("eventTitles.CHECK_IN_SUBMITTED"),
    CHECK_OUT_REQUESTED: t("eventTitles.CHECK_OUT_REQUESTED"),
    CHECK_OUT_SUBMITTED: t("eventTitles.CHECK_OUT_SUBMITTED"),
  }

  const staticDetailMap: Record<string, string> = {
    LINK_CREATED: t("eventDetails.LINK_CREATED"),
    LINK_OPENED: t("eventDetails.LINK_OPENED"),
    LINK_UPDATED: t("eventDetails.LINK_UPDATED"),
    LINK_CANCELLED: t("eventDetails.LINK_CANCELLED"),
    COMPLETED: t("eventDetails.COMPLETED"),
    SIGNED_PDF_GENERATED: t("eventDetails.SIGNED_PDF_GENERATED"),
    CONTRACT_REVIEWED: t("eventDetails.CONTRACT_REVIEWED"),
    CUSTOM_FIELDS_SUBMITTED: t("eventDetails.CUSTOM_FIELDS_SUBMITTED"),
    KYC_STARTED: t("eventDetails.KYC_STARTED"),
    SERVICE_PAYMENT_REQUESTED: t("eventDetails.SERVICE_PAYMENT_REQUESTED"),
  }

  function formatEventMoney(amount: number, currency: string) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100)
    } catch {
      return `${currency} ${(amount / 100).toFixed(2)}`
    }
  }

  type TransactionEvent = { type: string; title: string; detail: string | null; metadata: unknown }

  function getTranslatedEvent(event: TransactionEvent): { title: string; detail: string | null } {
    const title = eventTitleMap[event.type] ?? event.title
    const meta =
      typeof event.metadata === "object" && event.metadata !== null && !Array.isArray(event.metadata)
        ? (event.metadata as Record<string, unknown>)
        : null

    const rawAmount =
      meta && typeof meta.processedAmount === "number"
        ? meta.processedAmount
        : meta && typeof meta.amount === "number"
          ? meta.amount
          : null
    const currency = meta && typeof meta.currency === "string" ? meta.currency : null

    switch (event.type) {
      case "DEPOSIT_AUTHORIZED":
        if (rawAmount !== null && currency) {
          return { title, detail: t("eventDetails.DEPOSIT_AUTHORIZED", { amount: formatEventMoney(rawAmount, currency) }) }
        }
        break
      case "DEPOSIT_CAPTURED":
        if (rawAmount !== null && currency) {
          return { title, detail: t("eventDetails.DEPOSIT_CAPTURED", { amount: formatEventMoney(rawAmount, currency) }) }
        }
        break
      case "DEPOSIT_RELEASED":
        if (rawAmount !== null && currency) {
          return { title, detail: t("eventDetails.DEPOSIT_RELEASED", { amount: formatEventMoney(rawAmount, currency) }) }
        }
        break
      case "SERVICE_PAYMENT_SUCCEEDED":
        if (rawAmount !== null && currency) {
          return { title, detail: t("eventDetails.SERVICE_PAYMENT_SUCCEEDED", { amount: formatEventMoney(rawAmount, currency) }) }
        }
        break
    }

    const staticDetail = staticDetailMap[event.type]
    return { title, detail: staticDetail ?? event.detail }
  }

  const { session, dbUser, subscription, vendorProfile } = await requireSubscribedVendorAccess()
  const isAdmin = isAdminRole(session.user.role)

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: transactionId,
    },
    include: {
      vendor: true,
      clientProfile: true,
      bulkRecipient: true,
      contractTemplate: true,
      link: true,
      requirements: {
        orderBy: { sortOrder: "asc" },
      },
      customFields: {
        orderBy: { sortOrder: "asc" },
      },
      reportFields: {
        orderBy: { sortOrder: "asc" },
      },
      reports: {
        include: { assets: { orderBy: { sortOrder: "asc" } }, responses: true },
      },
      documents: {
        orderBy: { uploadedAt: "asc" },
      },
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

  const canRecreateTransaction =
    transaction.status === "COMPLETED" && transaction.vendorId === vendorProfile.id
  const recreateDialogData = canRecreateTransaction
    ? await getVendorCreateLinkDialogData(session.user.email)
    : null
  const recreateInitialValues =
    canRecreateTransaction && recreateDialogData
      ? buildTransactionCreationInitialValues(transaction, {
          availableContractIds: recreateDialogData.contracts.map((contract) => contract.id),
          availableChecklistIds: recreateDialogData.checklists.map((checklist) => checklist.id),
        })
      : null

  const shareLink = transaction.link ? `${getAppBaseUrl()}/${transaction.locale.toLowerCase()}/t/${transaction.link.token}` : null
  const signedPdfHref = resolveDocumentAssetUrl(transaction.contractArtifact?.signedPdfUrl, `${transaction.reference}-signed.pdf`)
  const servicePaymentAlreadyCollected = transaction.payments.some(
    (payment: (typeof transaction.payments)[number]) =>
      payment.kind === "SERVICE_PAYMENT" &&
      (payment.status === "SUCCEEDED" || payment.status === "CAPTURED")
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
        bulkRecipient: transaction.bulkRecipient
          ? {
              email: transaction.bulkRecipient.email,
            }
          : null,
        link: transaction.link,
      }, { qrRemaining: remainingQrCodes(subscription) })
    : null

  return (
    <div className="space-y-6">
      <div className="flex mb-4 bg-white p-4 rounded-md shadow-sm items-center justify-between gap-4">
        <div >
          <h1 className="text-3xl font-bold tracking-tight">{transaction.title}</h1>
          <p className="text-muted-foreground mt-2">
            {t("reference")}: {transaction.reference}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {recreateDialogData && recreateInitialValues ? (
            <RecreateTransactionAction
              contracts={recreateDialogData.contracts}
              checklists={recreateDialogData.checklists}
              initialValues={recreateInitialValues}
              usage={buildVendorActionsUsage(subscription)}
              hasStripe={vendorProfile.stripeConnectionStatus === "CONNECTED"}
              canLaunch={isVendorApproved(vendorProfile)}
              blockedMessage={getVendorStatusMessage(vendorProfile.reviewStatus)}
            />
          ) : null}
          <Badge variant={transaction.status === "COMPLETED" ? "default" : "secondary"}>
            {transactionStatusMap[transaction.status] ?? transaction.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("client")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {transaction.clientProfile?.fullName || t("pending")}
            </div>
            {(transaction.clientProfile?.email || transaction.bulkRecipient?.email) && (
              <div className="text-xs text-muted-foreground truncate">
                {transaction.clientProfile?.email ?? transaction.bulkRecipient?.email}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("paymentStatusLabel")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {(() => {
                const status = transaction.payments.find(
                  (payment: (typeof transaction.payments)[number]) => payment.kind === "SERVICE_PAYMENT"
                )?.status
                return status
                  ? (paymentStatusMap[status] ?? status)
                  : (transaction.amount ? t("pending") : t("na"))
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("depositStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {(() => {
                const status = transaction.depositAuthorization?.status
                return status
                  ? (paymentStatusMap[status] ?? status)
                  : (transaction.depositAmount ? t("pending") : t("none"))
              })()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("docsUploaded")}</CardTitle>
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

      {transaction.flowType === "CHECK_IN_OUT" ? (() => {
        const checkInReport = transaction.reports.find((r) => r.type === "CHECK_IN") ?? null
        const checkOutReport = transaction.reports.find((r) => r.type === "CHECK_OUT") ?? null
        const checkInFields = transaction.reportFields.filter((f) => f.reportType === "CHECK_IN")
        const checkOutFields = transaction.reportFields.filter((f) => f.reportType === "CHECK_OUT")
        const checkInResponseMap = new Map(
          (checkInReport?.responses ?? []).map((r) => [r.fieldId, r.value] as const)
        )
        const checkOutResponseMap = new Map(
          (checkOutReport?.responses ?? []).map((r) => [r.fieldId, r.value] as const)
        )
        const hasCheckInData = Boolean(checkInReport?.submittedAt)
        const hasCheckOutData = Boolean(checkOutReport?.submittedAt)

        function toThumb(url: string) {
          if (!url.includes("/upload/")) return url
          return url.replace("/upload/", "/upload/w_600,h_450,c_fill,q_auto,f_auto/")
        }

        function ReportPanel({
          label,
          accent,
          submittedAt,
          fields,
          responseMap,
          assets,
        }: {
          label: string
          accent: "amber" | "rose"
          submittedAt: Date | null
          fields: typeof checkInFields
          responseMap: Map<string, string>
          assets: Array<{ assetUrl: string; fileName: string; publicId: string }>
        }) {
          const borderCls = accent === "amber" ? "border-amber-200" : "border-rose-200"
          const badgeCls = accent === "amber"
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-rose-300 bg-rose-50 text-rose-800"
          const headingCls = accent === "amber" ? "text-amber-700" : "text-rose-700"
          const ringCls = accent === "amber" ? "ring-amber-100" : "ring-rose-100"

          return (
            <div className={`flex flex-col gap-4 rounded-xl border ${borderCls} bg-white p-5 shadow-sm`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeCls}`}>
                  {label}
                </span>
                {submittedAt ? (
                  <span className="text-xs text-muted-foreground">
                    {submittedAt.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Pending</span>
                )}
              </div>

              {fields.length > 0 && submittedAt ? (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground w-1/2">Field</th>
                        <th className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] ${headingCls} w-1/2`}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, i) => (
                        <tr key={field.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                          <td className="px-3 py-2.5 text-sm font-medium text-foreground">{field.label}</td>
                          <td className="px-3 py-2.5 text-sm text-foreground">{responseMap.get(field.id) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : fields.length === 0 ? null : (
                <p className="text-sm text-muted-foreground italic">Not yet submitted.</p>
              )}

              <div>
                <p className={`mb-2 text-[11px] font-semibold uppercase tracking-widest ${headingCls}`}>
                  Photos {assets?.length ? `(${assets.length})` : ""}
                </p>
                {assets?.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {assets.map((asset, i) => (
                      <a
                        key={i}
                        href={asset.assetUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={asset.fileName}
                        className={`block overflow-hidden rounded-lg ring-2 ${ringCls} transition-opacity hover:opacity-80`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={toThumb(asset.assetUrl)}
                          alt={asset.fileName}
                          className="aspect-square w-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                ) : submittedAt ? (
                  <p className="text-sm text-muted-foreground">No photos uploaded.</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Pending submission.</p>
                )}
              </div>
            </div>
          )
        }

        return (
          <>
            <RequestCheckoutCard
              transactionId={transaction.id}
              checkInSubmittedAt={checkInReport?.submittedAt?.toISOString() ?? null}
              checkOutRequestedAt={transaction.checkOutRequestedAt?.toISOString() ?? null}
              checkOutSubmittedAt={checkOutReport?.submittedAt?.toISOString() ?? null}
            />

            {hasCheckInData || hasCheckOutData ? (
              <Card>
                <CardHeader>
                  <CardTitle>Condition Reports</CardTitle>
                  <CardDescription>
                    Customer-submitted readings and photos for each phase of this service.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`grid gap-4 ${hasCheckOutData ? "md:grid-cols-2" : ""}`}>
                    <ReportPanel
                      label="Check-In"
                      accent="amber"
                      submittedAt={checkInReport?.submittedAt ?? null}
                      fields={checkInFields}
                      responseMap={checkInResponseMap}
                      assets={checkInReport?.assets ?? []}
                    />
                    {hasCheckOutData ? (
                      <ReportPanel
                        label="Check-Out"
                        accent="rose"
                        submittedAt={checkOutReport?.submittedAt ?? null}
                        fields={checkOutFields}
                        responseMap={checkOutResponseMap}
                        assets={checkOutReport?.assets ?? []}
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        )
      })() : null}

      {transaction.link ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{t("clientAccessTitle")}</CardTitle>
                <CardDescription>{t("clientAccessDescription")}</CardDescription>
              </div>
              {linkRecord ? (
                <StatusBadge tone={getStatusTone(linkRecord.status)}>
                  {linkStatusMap[linkRecord.status] ?? linkRecord.status}
                </StatusBadge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t("customerLink")}</p>
              <Link
                href={shareLink ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex cursor-pointer items-center text-(--contrazy-teal) hover:underline"
              >
                {t("openSecureClientFlow")}
              </Link>
              <p className="mt-2 text-xs">{t("reference")}: {transaction.reference}</p>
              {linkRecord?.cancelReason ? (
                <p className="mt-2 text-xs text-destructive">
                  {t("cancelled")}: {linkRecord.cancelReason}
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
                <p className="font-medium text-foreground">{t("noQrGenerated")}</p>
                <p className="mt-1">
                  {linkRecord?.canGenerateQr
                    ? t("generateQrHint")
                    : linkRecord?.qrUnavailableReason ?? t("qrUnavailable")}
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
            <CardTitle>{t("agreementArtifactTitle")}</CardTitle>
            <CardDescription>{t("agreementArtifactDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("snapshot")}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {transaction.contractArtifact?.sourceTemplateName ?? transaction.contractTemplate?.name ?? t("attached")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transaction.contractArtifact?.generatedAt
                    ? t("created", { date: transaction.contractArtifact.generatedAt.toLocaleString() })
                    : t("noSnapshot")}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("review")}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {transaction.contractArtifact?.reviewCompletedAt ? t("reviewed") : t("reviewPending")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transaction.contractArtifact?.reviewCompletedAt
                    ? transaction.contractArtifact.reviewCompletedAt.toLocaleString()
                    : t("reviewIncomplete")}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t("signedPdf")}</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {transaction.contractArtifact?.signedPdfUrl ? t("generated") : t("signedPdfPending")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {transaction.contractArtifact?.signedAt
                    ? transaction.contractArtifact.signedAt.toLocaleString()
                    : t("finalPdfPending")}
                </p>
              </div>
            </div>

            {transaction.contractArtifact?.renderedContentBeforeSignature ? (
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="mb-3 text-sm font-medium text-foreground">{t("agreementSnapshot")}</p>
                <div className="max-h-80 overflow-y-auto rounded-md border bg-white p-4">
                  <ContractDocument html={transaction.contractArtifact.renderedContentBeforeSignature} />
                </div>
              </div>
            ) : null}

            {transaction.contractArtifact?.signedPdfUrl ? (
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">{t("signedAgreement")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <Link
                    href={signedPdfHref ?? transaction.contractArtifact.signedPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex cursor-pointer items-center text-(--contrazy-teal) hover:underline"
                  >
                    {t("downloadSignedPdf")}
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
            <CardTitle>{t("requirementsTitle")}</CardTitle>
            <CardDescription>{t("requirementsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {transaction.requirements.map((requirement: (typeof transaction.requirements)[number]) => {
              const response = transaction.documents.find(
                (document: (typeof transaction.documents)[number]) => document.requirementId === requirement.id
              )

              return (
                <div key={requirement.id} className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{requirement.label}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {requirement.type}
                        {requirement.required ? ` · ${t("required")}` : ` · ${t("optional")}`}
                      </p>
                      {requirement.instructions ? (
                        <p className="mt-2 text-sm text-muted-foreground">{requirement.instructions}</p>
                      ) : null}
                    </div>
                    <StatusBadge tone={response ? "success" : "warning"}>
                      {response ? t("submitted") : t("pending")}
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
                        {response.fileName ?? t("downloadUploadedFile")}
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
          <CardTitle>{sharedT("timelineTitle")}</CardTitle>
          <CardDescription>{t("timelineDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transaction.events.length > 0 ? (
              transaction.events.map((event: (typeof transaction.events)[number]) => {
                const { title, detail } = getTranslatedEvent(event)
                return (
                  <div key={event.id} className="flex gap-4">
                    <div className="w-28 shrink-0 text-sm text-muted-foreground">
                      {event.occurredAt.toLocaleDateString()}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>{title}</div>
                      {detail ? <div className="text-muted-foreground">{detail}</div> : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex gap-4">
                <div className="w-28 shrink-0 text-sm text-muted-foreground">
                  {transaction.createdAt.toLocaleDateString()}
                </div>
                <div className="text-sm">{t("transactionCreated")}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
