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
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Eye,
  FileCheck,
  FileText,
  Link2,
  Lock,
  Mail,
  Receipt,
  ShieldCheck,
  Unlock,
  User,
  XCircle,
} from "lucide-react"

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
import { TransactionRequirementsCard } from "@/features/dashboard/components/transaction-requirements-card"
import { buildTransactionCreationInitialValues } from "@/features/transactions/server/transaction-recreation"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function VendorTransactionDetailPage(props: {
  params: Promise<{ transactionId: string; locale: string }>
}) {
  const { transactionId, locale } = await props.params
  const t = await getTranslations("dashboard.vendor.transactionDetailPage")
  const sharedT = await getTranslations("dashboard.shared")

  type ReportAssetRecord = {
    assetUrl: string
    fileName: string
    publicId: string
    mimeType: string | null
    fieldId: string | null
  }

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

  const { session, dbUser, subscription, vendorProfile } = await requireSubscribedVendorAccess()
  const isAdmin = isAdminRole(session.user.role)

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      vendor: true,
      clientProfile: true,
      bulkRecipient: true,
      contractTemplate: true,
      link: true,
      requirements: { orderBy: { sortOrder: "asc" } },
      customFields: { orderBy: { sortOrder: "asc" } },
      reportFields: { orderBy: { sortOrder: "asc" } },
      reports: {
        include: { assets: { orderBy: { sortOrder: "asc" } }, responses: true },
      },
      documents: { orderBy: { uploadedAt: "asc" } },
      payments: true,
      depositAuthorization: true,
      signatureRecord: true,
      contractArtifact: true,
      kycVerification: true,
      events: { orderBy: { occurredAt: "asc" } },
    },
  })

  if (!transaction) notFound()

  if (!isAdmin) {
    const currentVendorUserId = dbUser?.id
    const transactionOwnerUserId = transaction.vendor?.userId
    if (!currentVendorUserId || transactionOwnerUserId !== currentVendorUserId) notFound()
  }

  // ── Derived financial data ────────────────────────────────────────────────────

  const txLocale = transaction.locale ?? locale ?? "en"
  const intlLocale = txLocale === "fr" ? "fr-FR" : "en-GB"
  const transactionCurrency = transaction.currency ?? "EUR"

  function fmt(amount: number | null | undefined, currency?: string): string {
    if (amount == null) return "—"
    const resolvedCurrency = currency ?? transactionCurrency
    try {
      return new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency: resolvedCurrency.toUpperCase(),
      }).format(amount / 100)
    } catch {
      return `${resolvedCurrency.toUpperCase()} ${((amount ?? 0) / 100).toFixed(2)}`
    }
  }

  const servicePayment = transaction.payments.find((p) => p.kind === "SERVICE_PAYMENT")
  const depositCapturePmt = transaction.payments.find((p) => p.kind === "DEPOSIT_CAPTURE")
  const depositReleasePmt = transaction.payments.find((p) => p.kind === "DEPOSIT_RELEASE")
  const hasServiceFinance = Boolean(transaction.amount || servicePayment)
  const hasDepositFinance = Boolean(transaction.depositAmount || transaction.depositAuthorization)

  const servicePaymentAlreadyCollected =
    servicePayment?.status === "SUCCEEDED" || servicePayment?.status === "CAPTURED"

  // ── Recreate dialog ───────────────────────────────────────────────────────────

  const canRecreateTransaction =
    transaction.status === "COMPLETED" && transaction.vendorId === vendorProfile.id
  const recreateDialogData = canRecreateTransaction
    ? await getVendorCreateLinkDialogData(session.user.email)
    : null
  const recreateInitialValues =
    canRecreateTransaction && recreateDialogData
      ? buildTransactionCreationInitialValues(transaction, {
          availableContractIds: recreateDialogData.contracts.map((c) => c.id),
          availableChecklistIds: recreateDialogData.checklists.map((c) => c.id),
        })
      : null

  const shareLink = transaction.link
    ? `${getAppBaseUrl()}/${transaction.locale.toLowerCase()}/t/${transaction.link.token}`
    : null
  const signedPdfHref = resolveDocumentAssetUrl(
    transaction.contractArtifact?.signedPdfUrl,
    `${transaction.reference}-signed.pdf`
  )

  const linkRecord = transaction.link
    ? buildVendorLinkRecord(
        {
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
            ? { fullName: transaction.clientProfile.fullName, email: transaction.clientProfile.email }
            : null,
          bulkRecipient: transaction.bulkRecipient ? { email: transaction.bulkRecipient.email } : null,
          link: transaction.link,
        },
        { qrRemaining: remainingQrCodes(subscription) }
      )
    : null

  // ── Event helpers ─────────────────────────────────────────────────────────────

  function formatEventMoney(amount: number, currency: string) {
    return fmt(amount, currency)
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
        if (rawAmount !== null && currency)
          return { title, detail: t("eventDetails.DEPOSIT_AUTHORIZED", { amount: formatEventMoney(rawAmount, currency) }) }
        break
      case "DEPOSIT_CAPTURED":
        if (rawAmount !== null && currency)
          return { title, detail: t("eventDetails.DEPOSIT_CAPTURED", { amount: formatEventMoney(rawAmount, currency) }) }
        break
      case "DEPOSIT_RELEASED":
        if (rawAmount !== null && currency)
          return { title, detail: t("eventDetails.DEPOSIT_RELEASED", { amount: formatEventMoney(rawAmount, currency) }) }
        break
      case "SERVICE_PAYMENT_SUCCEEDED":
        if (rawAmount !== null && currency)
          return { title, detail: t("eventDetails.SERVICE_PAYMENT_SUCCEEDED", { amount: formatEventMoney(rawAmount, currency) }) }
        break
    }

    const staticDetail = staticDetailMap[event.type]
    return { title, detail: staticDetail ?? event.detail }
  }

  function getEventIcon(type: string) {
    const cls = "size-[15px]"
    if (type === "LINK_CREATED" || type === "TRANSACTION_RECREATED") return <Link2 className={cls} />
    if (type === "LINK_OPENED") return <Eye className={cls} />
    if (type === "LINK_UPDATED" || type === "LINK_CANCELLED") return <Link2 className={cls} />
    if (type === "PROFILE_SUBMITTED") return <User className={cls} />
    if (type === "DOCUMENTS_SUBMITTED" || type === "CUSTOM_FIELDS_SUBMITTED") return <FileText className={cls} />
    if (type === "KYC_STARTED" || type === "KYC_VERIFIED" || type === "KYC_FAILED") return <ShieldCheck className={cls} />
    if (type === "CONTRACT_REVIEWED" || type === "CONTRACT_SNAPSHOT_CREATED") return <FileCheck className={cls} />
    if (type === "SIGNATURE_COMPLETED" || type === "SIGNED_PDF_GENERATED") return <FileCheck className={cls} />
    if (type === "SERVICE_PAYMENT_SUCCEEDED" || type === "SERVICE_PAYMENT_REQUESTED" || type === "PAYMENT_SESSION_CREATED") return <CircleDollarSign className={cls} />
    if (type === "DEPOSIT_AUTHORIZED") return <Lock className={cls} />
    if (type === "DEPOSIT_CAPTURED" || type === "DEPOSIT_CHARGED") return <Banknote className={cls} />
    if (type === "DEPOSIT_RELEASED") return <Unlock className={cls} />
    if (type === "COMPLETED") return <CheckCircle2 className={cls} />
    if (type === "EMAIL_SENT") return <Mail className={cls} />
    if (type === "DISPUTE_OPENED") return <AlertTriangle className={cls} />
    if (type === "TRANSACTION_CANCELLED") return <XCircle className={cls} />
    if (type === "CHECK_IN_SUBMITTED" || type === "CHECK_OUT_SUBMITTED" || type === "CHECK_OUT_REQUESTED") return <FileText className={cls} />
    return <Clock className={cls} />
  }

  function getEventColorCls(type: string): string {
    if (
      ["SERVICE_PAYMENT_SUCCEEDED", "COMPLETED", "DEPOSIT_RELEASED", "KYC_VERIFIED", "SIGNATURE_COMPLETED", "SIGNED_PDF_GENERATED"].includes(type)
    ) return "border-emerald-300 bg-emerald-50 text-emerald-600"
    if (
      ["DEPOSIT_AUTHORIZED", "DEPOSIT_CHARGED", "LINK_CREATED", "LINK_UPDATED", "TRANSACTION_RECREATED"].includes(type)
    ) return "border-blue-300 bg-blue-50 text-blue-600"
    if (
      ["DEPOSIT_CAPTURED", "DOCUMENTS_SUBMITTED", "PROFILE_SUBMITTED", "CONTRACT_REVIEWED", "CUSTOM_FIELDS_SUBMITTED", "CHECK_IN_SUBMITTED", "CHECK_OUT_SUBMITTED"].includes(type)
    ) return "border-amber-300 bg-amber-50 text-amber-600"
    if (
      ["KYC_STARTED", "KYC_FAILED", "CONTRACT_SNAPSHOT_CREATED", "PAYMENT_SESSION_CREATED", "SERVICE_PAYMENT_REQUESTED"].includes(type)
    ) return "border-violet-300 bg-violet-50 text-violet-600"
    if (
      ["DISPUTE_OPENED", "TRANSACTION_CANCELLED", "LINK_CANCELLED"].includes(type)
    ) return "border-rose-300 bg-rose-50 text-rose-600"
    return "border-slate-200 bg-slate-50 text-slate-500"
  }

  // ── JSX ───────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{transaction.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono text-xs">{transaction.reference}</span>
            {transaction.clientProfile?.email && (
              <>
                <span className="text-border">·</span>
                <span>{transaction.clientProfile.email}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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

      {/* ── Stat cards row ───────────────────────────────────────────────────── */}
      <div
        className={cn(
          "grid gap-3",
          hasServiceFinance || hasDepositFinance ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"
        )}
      >
        {/* Client */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("client")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="truncate text-base font-bold">
              {transaction.clientProfile?.fullName || t("pending")}
            </div>
            {(transaction.clientProfile?.email || transaction.bulkRecipient?.email) && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {transaction.clientProfile?.email ?? transaction.bulkRecipient?.email}
              </div>
            )}
          </CardContent>
        </Card>

        {hasServiceFinance ? (
          <Card className="shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("paymentStatusLabel")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-base font-bold">
                {transaction.amount ? fmt(servicePayment?.amount ?? transaction.amount) : t("na")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {servicePayment
                  ? paymentStatusMap[servicePayment.status] ?? servicePayment.status
                  : transaction.amount
                    ? t("pending")
                    : t("na")}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {hasDepositFinance ? (
          <Card className="shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("depositStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-base font-bold">
                {transaction.depositAuthorization
                  ? fmt(transaction.depositAuthorization.amount)
                  : transaction.depositAmount
                    ? fmt(transaction.depositAmount)
                    : t("none")}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {transaction.depositAuthorization
                  ? paymentStatusMap[transaction.depositAuthorization.status] ?? transaction.depositAuthorization.status
                  : transaction.depositAmount
                    ? t("pending")
                    : t("none")}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Documents */}
        <Card className="shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("docsUploaded")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold">
              {transaction.documents.filter((d) => d.requirementId).length}
              {" / "}
              {transaction.requirements.reduce((sum, r) => sum + (r.requiredFileCount ?? 1), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Financial Overview ───────────────────────────────────────────────── */}
      {(transaction.amount || transaction.depositAmount || transaction.depositAuthorization) ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("financialOverview")}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            {/* Service Payment panel */}
            {transaction.amount ? (
              <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50">
                      <CircleDollarSign className="size-4 text-blue-600" />
                    </span>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t("servicePaymentTitle")}
                    </p>
                  </div>
                  {servicePayment ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                        servicePaymentAlreadyCollected
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600"
                      )}
                    >
                      {paymentStatusMap[servicePayment.status] ?? servicePayment.status}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      {t("pending")}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-[13px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">{t("configuredAmount")}</span>
                    <span className="font-semibold text-foreground">{fmt(transaction.amount)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">{t("collected")}</span>
                    <span className="font-semibold text-foreground">
                      {servicePayment ? fmt(servicePayment.amount) : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">{t("platformFees")}</span>
                    <span className="text-muted-foreground">{t("none")}</span>
                  </div>
                  <div className="my-2 border-t border-border/60" />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{t("netToYou")}</span>
                    <span className="text-base font-bold text-emerald-700">
                      {servicePayment ? fmt(servicePayment.vendorNetAmount ?? servicePayment.amount) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Deposit panel */}
            {(transaction.depositAmount || transaction.depositAuthorization) ? (
              <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50">
                      <Lock className="size-4 text-amber-600" />
                    </span>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {t("securityDepositTitle")}
                    </p>
                  </div>
                  {transaction.depositAuthorization && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                        transaction.depositAuthorization.status === "CAPTURED"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : transaction.depositAuthorization.status === "RELEASED"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : transaction.depositAuthorization.status === "AUTHORIZED" || transaction.depositAuthorization.status === "SUCCEEDED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-100 text-slate-600"
                      )}
                    >
                      {paymentStatusMap[transaction.depositAuthorization.status] ?? transaction.depositAuthorization.status}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-[13px]">
                  {transaction.depositAmount ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground">{t("configured")}</span>
                      <span className="font-semibold text-foreground">{fmt(transaction.depositAmount)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">{t("authorizedHold")}</span>
                    <span className="font-semibold text-foreground">
                      {transaction.depositAuthorization ? fmt(transaction.depositAuthorization.amount) : "—"}
                    </span>
                  </div>

                  {/* Capture breakdown */}
                  {depositCapturePmt ? (
                    <>
                      <div className="my-2 border-t border-border/60" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">{t("captured")}</span>
                        <span className="font-semibold text-foreground">{fmt(depositCapturePmt.amount)}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-muted-foreground">{t("contrazyFeeInclVat")}</span>
                        <span className="text-muted-foreground">− {fmt(depositCapturePmt.platformFeeAmount)}</span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground/60">
                          {t("stripeFee")}{" "}
                          <span className="text-[10px]">({t("billedByStripe")})</span>
                        </span>
                        <span className="text-[11px] text-muted-foreground/60">
                          − {fmt(depositCapturePmt.stripeFeeAmount)}
                        </span>
                      </div>
                      <div className="my-2 border-t border-border/60" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">{t("netFromCapture")}</span>
                        <span className="text-base font-bold text-emerald-700">
                          {fmt(depositCapturePmt.vendorNetAmount)}
                        </span>
                      </div>
                    </>
                  ) : depositReleasePmt ? (
                    <>
                      <div className="my-2 border-t border-border/60" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">{t("releasedToClient")}</span>
                        <span className="font-semibold text-blue-700">{fmt(depositReleasePmt.amount)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="my-2 border-t border-border/60" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-muted-foreground">{t("captured")}</span>
                        <span className="text-muted-foreground">{t("notYetCaptured")}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

          </div>
        </section>
      ) : null}

      {/* ── Action cards ─────────────────────────────────────────────────────── */}
      {transaction.depositAuthorization && (
        <DepositControlCard
          transactionId={transaction.id}
          depositStatus={transaction.depositAuthorization.status}
          transactionStatus={transaction.status}
          depositStrategy={transaction.depositAuthorization.depositStrategy}
          depositAutoRefundAt={transaction.depositAuthorization.depositAutoRefundAt}
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

      {/* ── Check-In / Check-Out ─────────────────────────────────────────────── */}
      {transaction.flowType === "CHECK_IN_OUT"
        ? (() => {
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
            const checkInAssetMap = new Map<string, ReportAssetRecord[]>()
            const checkOutAssetMap = new Map<string, ReportAssetRecord[]>()
            const checkInLegacyAssets = (checkInReport?.assets ?? []).filter((asset) => !asset.fieldId)
            const checkOutLegacyAssets = (checkOutReport?.assets ?? []).filter((asset) => !asset.fieldId)

            for (const asset of checkInReport?.assets ?? []) {
              if (!asset.fieldId) continue
              const current = checkInAssetMap.get(asset.fieldId) ?? []
              current.push(asset)
              checkInAssetMap.set(asset.fieldId, current)
            }

            for (const asset of checkOutReport?.assets ?? []) {
              if (!asset.fieldId) continue
              const current = checkOutAssetMap.get(asset.fieldId) ?? []
              current.push(asset)
              checkOutAssetMap.set(asset.fieldId, current)
            }

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
              assetMap,
              legacyAssets,
            }: {
              label: string
              accent: "amber" | "rose"
              submittedAt: Date | null
              fields: typeof checkInFields
              responseMap: Map<string, string>
              assetMap: Map<
                string,
                Array<{
                  assetUrl: string
                  fileName: string
                  publicId: string
                  mimeType: string | null
                  fieldId: string | null
                }>
              >
              legacyAssets: Array<{
                assetUrl: string
                fileName: string
                publicId: string
                mimeType: string | null
                fieldId: string | null
              }>
            }) {
              const borderCls = accent === "amber" ? "border-amber-200" : "border-rose-200"
              const badgeCls =
                accent === "amber"
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-rose-300 bg-rose-50 text-rose-800"
              const headingCls = accent === "amber" ? "text-amber-700" : "text-rose-700"
              const ringCls = accent === "amber" ? "ring-amber-100" : "ring-rose-100"
              const scalarFields = fields.filter(
                (field) => field.fieldType !== "PHOTO" && field.fieldType !== "FILE"
              )
              const uploadFields = fields.filter(
                (field) => field.fieldType === "PHOTO" || field.fieldType === "FILE"
              )

              return (
                <div className={`flex flex-col gap-4 rounded-xl border ${borderCls} bg-white p-5 shadow-sm`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeCls}`}>
                      {label}
                    </span>
                    {submittedAt ? (
                      <span className="text-xs text-muted-foreground">{submittedAt.toLocaleString(intlLocale)}</span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">{t("pending")}</span>
                    )}
                  </div>
                  {scalarFields.length > 0 && submittedAt ? (
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="w-1/2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t("fieldHeader")}</th>
                            <th className={`w-1/2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] ${headingCls}`}>{t("valueHeader")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scalarFields.map((field, i) => (
                            <tr key={field.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                              <td className="px-3 py-2.5 text-sm font-medium text-foreground">{field.label}</td>
                              <td className="px-3 py-2.5 text-sm text-foreground">{responseMap.get(field.id) ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : scalarFields.length === 0 ? null : (
                    <p className="text-sm italic text-muted-foreground">{t("notYetSubmitted")}</p>
                  )}
                  {uploadFields.length > 0 ? (
                    <div className="space-y-3">
                      {uploadFields.map((field) => {
                        const assets = assetMap.get(field.id) ?? []
                        const isPhotoField = field.fieldType === "PHOTO"

                        return (
                          <div key={field.id}>
                            <p className={`mb-2 text-[11px] font-semibold uppercase tracking-widest ${headingCls}`}>
                              {field.label} {assets.length ? `(${assets.length})` : ""}
                            </p>
                            {assets.length > 0 ? (
                              isPhotoField ? (
                                <div className="grid grid-cols-3 gap-2">
                                  {assets.map((asset, index) => (
                                    <a key={`${asset.publicId}-${index}`} href={asset.assetUrl} target="_blank" rel="noreferrer" title={asset.fileName} className={`block overflow-hidden rounded-lg ring-2 ${ringCls} transition-opacity hover:opacity-80`}>
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={toThumb(asset.assetUrl)} alt={asset.fileName} className="aspect-square w-full object-cover" loading="lazy" />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {assets.map((asset, index) => (
                                    <a
                                      key={`${asset.publicId}-${index}`}
                                      href={asset.assetUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground hover:bg-muted/35"
                                    >
                                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                                      <span className="truncate">{asset.fileName}</span>
                                    </a>
                                  ))}
                                </div>
                              )
                            ) : submittedAt ? (
                              <p className="text-sm text-muted-foreground">
                                {isPhotoField ? t("noPhotosUploaded") : t("noFilesUploaded")}
                              </p>
                            ) : (
                              <p className="text-sm italic text-muted-foreground">{t("pendingSubmission")}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                  {legacyAssets.length > 0 ? (
                    <div>
                      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-widest ${headingCls}`}>
                        {t("photosLabel")} ({legacyAssets.length})
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {legacyAssets.map((asset, index) => (
                          <a key={`${asset.publicId}-${index}`} href={asset.assetUrl} target="_blank" rel="noreferrer" title={asset.fileName} className={`block overflow-hidden rounded-lg ring-2 ${ringCls} transition-opacity hover:opacity-80`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={toThumb(asset.assetUrl)} alt={asset.fileName} className="aspect-square w-full object-cover" loading="lazy" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
                      <CardTitle>{t("conditionReportsTitle")}</CardTitle>
                      <CardDescription>
                        {t("conditionReportsDescription")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className={`grid gap-4 ${hasCheckOutData ? "md:grid-cols-2" : ""}`}>
                        <ReportPanel
                          label={t("checkInLabel")}
                          accent="amber"
                          submittedAt={checkInReport?.submittedAt ?? null}
                          fields={checkInFields}
                          responseMap={checkInResponseMap}
                          assetMap={checkInAssetMap}
                          legacyAssets={checkInLegacyAssets}
                        />
                        {hasCheckOutData ? (
                          <ReportPanel
                            label={t("checkOutLabel")}
                            accent="rose"
                            submittedAt={checkOutReport?.submittedAt ?? null}
                            fields={checkOutFields}
                            responseMap={checkOutResponseMap}
                            assetMap={checkOutAssetMap}
                            legacyAssets={checkOutLegacyAssets}
                          />
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </>
            )
          })()
        : null}

      {/* ── Client access ────────────────────────────────────────────────────── */}
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
              <p className="mt-2 text-xs">
                {t("reference")}: {transaction.reference}
              </p>
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
                    : (linkRecord?.qrUnavailableReason ?? t("qrUnavailable"))}
                </p>
              </div>
            )}
            {linkRecord ? <PaymentLinkManagementActions record={linkRecord} variant="detail" /> : null}
          </CardContent>
        </Card>
      ) : null}

      {/* ── KYC ─────────────────────────────────────────────────────────────── */}
      {transaction.requiresKyc && transaction.kycVerification && (
        <KycReviewCard transactionId={transaction.id} kyc={transaction.kycVerification} />
      )}

      {/* ── Contract / agreement ─────────────────────────────────────────────── */}
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

      {/* ── Requirements / documents ─────────────────────────────────────────── */}
      {transaction.requirements.length > 0 ? (
        <TransactionRequirementsCard
          requirements={transaction.requirements}
          documents={transaction.documents}
          transactionTitle={transaction.title}
        />
      ) : null}

      {/* ── Audit trail ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>{sharedT("timelineTitle")}</CardTitle>
          <CardDescription>{t("timelineDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {transaction.events.length === 0 ? (
            <div className="flex gap-4">
              <div className="w-32 shrink-0 text-sm text-muted-foreground">
                {transaction.createdAt.toLocaleDateString(intlLocale)}
              </div>
              <div className="text-sm">{t("transactionCreated")}</div>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-4.75 top-5 h-[calc(100%-40px)] w-px bg-border" />

              <div className="space-y-0">
                {transaction.events.map((event, index) => {
                  const { title, detail } = getTranslatedEvent(event)
                  const icon = getEventIcon(event.type)
                  const colorCls = getEventColorCls(event.type)
                  const isLast = index === transaction.events.length - 1

                  // Extract financial metadata for capture events
                  const meta =
                    typeof event.metadata === "object" &&
                    event.metadata !== null &&
                    !Array.isArray(event.metadata)
                      ? (event.metadata as Record<string, unknown>)
                      : null

                  const hasFinancialMeta =
                    event.type === "DEPOSIT_CAPTURED" &&
                    meta &&
                    typeof meta.processedAmount === "number" &&
                    typeof meta.currency === "string"

                  return (
                    <div key={event.id} className={cn("relative flex gap-4", !isLast && "pb-7")}>
                      {/* Icon circle */}
                      <div
                        className={cn(
                          "relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2",
                          colorCls
                        )}
                      >
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 pt-1.5">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="text-[13px] font-semibold text-foreground">{title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {event.occurredAt.toLocaleDateString(intlLocale, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            {" · "}
                            {event.occurredAt.toLocaleTimeString(intlLocale, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>

                        {detail && (
                          <p className="mt-0.5 text-[12px] text-muted-foreground">{detail}</p>
                        )}

                        {/* Fee breakdown for deposit capture */}
                        {hasFinancialMeta && meta ? (
                          <div className="mt-2 inline-grid grid-cols-2 gap-x-8 gap-y-1 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-[12px]">
                            <span className="text-muted-foreground">{t("grossCaptured")}</span>
                            <span className="font-semibold text-foreground text-right">
                              {fmt(meta.processedAmount as number, meta.currency as string)}
                            </span>
                            <span className="text-muted-foreground">{t("contrazyFeeInclVat")}</span>
                            <span className="text-muted-foreground text-right">
                              − {fmt(meta.platformFeeAmount as number, meta.currency as string)}
                            </span>
                            <span className="col-span-2 border-t border-amber-100 pt-1 text-[10px] text-muted-foreground/60">
                              {t("stripeFee")}: {fmt(meta.stripeFeeAmount as number, meta.currency as string)} — {t("billedByStripe")}
                            </span>
                            <span className="font-medium text-emerald-700 border-t border-amber-200 pt-1">{t("netToYou")}</span>
                            <span className="font-bold text-emerald-700 text-right border-t border-amber-200 pt-1">
                              {fmt(meta.vendorNetAmount as number, meta.currency as string)}
                            </span>
                          </div>
                        ) : null}

                        {/* Amount highlight for service payment and deposit auth */}
                        {(event.type === "SERVICE_PAYMENT_SUCCEEDED" || event.type === "DEPOSIT_AUTHORIZED" || event.type === "DEPOSIT_RELEASED") &&
                          meta &&
                          typeof meta.amount === "number" &&
                          typeof meta.currency === "string" ? (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">
                              <CheckCircle2 className="size-3" />
                              {fmt(
                                typeof meta.processedAmount === "number" ? meta.processedAmount : meta.amount,
                                meta.currency as string
                              )}
                            </div>
                          ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
