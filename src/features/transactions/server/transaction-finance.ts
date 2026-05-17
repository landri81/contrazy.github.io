import {
  AuditActorType,
  PaymentCollectionTiming,
  PaymentKind,
  PaymentStatus,
  Prisma,
  PrismaClient,
  TransactionStatus,
  type DepositAuthorization,
  type Payment,
  type Transaction,
  type TransactionLink,
  type TransactionContractArtifact,
  type VendorProfile,
  type ClientProfile,
} from "@prisma/client"
import type Stripe from "stripe"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { markTransactionLinkCompleted } from "@/features/transactions/server/transaction-links"
import {
  sendCustomerDepositStatusEmail,
  sendTransactionCompletedEmail,
  sendVendorDepositAlert,
  sendVendorDepositStatusEmail,
  sendVendorTransactionCompletedEmail,
  type SubmittedDoc,
} from "@/lib/integrations/resend"
import { getSiteUrl } from "@/lib/site-url"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

export type FinanceStage = "none" | "service_payment" | "deposit_authorization" | "complete"

export type FinanceTransaction = Transaction & {
  link: TransactionLink | null
  payments: Payment[]
  depositAuthorization: DepositAuthorization | null
  contractArtifact: TransactionContractArtifact | null
  vendor: VendorProfile | null
  clientProfile: ClientProfile | null
}

export type DepositFeeBreakdown = {
  stripeFeeAmount: number
  platformFeeAmount: number
  vendorNetAmount: number
}

export type DepositOutcomeReason =
  | "manual_capture"
  | "manual_release"
  | "transaction_cancelled"
  | "admin_dispute_release"
  | "vendor_dispute_release"

type FinanceAuditLogInput = {
  actorId?: string | null
  actorType?: AuditActorType
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Prisma.InputJsonValue
}

const authorizedDepositStatuses = new Set<PaymentStatus>([
  PaymentStatus.AUTHORIZED,
  PaymentStatus.SUCCEEDED, // CHARGE_REFUND deposits: money already captured, period is active
  PaymentStatus.CAPTURED,
  PaymentStatus.RELEASED,
])

function hasSuccessfulServicePayment(transaction: FinanceTransaction) {
  return transaction.payments.some(
    (payment) =>
      payment.kind === PaymentKind.SERVICE_PAYMENT &&
      (payment.status === PaymentStatus.SUCCEEDED || payment.status === PaymentStatus.CAPTURED)
  )
}

function hasAuthorizedDeposit(transaction: FinanceTransaction) {
  return Boolean(
    transaction.depositAuthorization &&
      authorizedDepositStatuses.has(transaction.depositAuthorization.status)
  )
}

function needsServicePayment(transaction: Pick<Transaction, "amount">) {
  return Boolean(transaction.amount && transaction.amount > 0)
}

function needsDepositAuthorization(transaction: Pick<Transaction, "depositAmount">) {
  return Boolean(transaction.depositAmount && transaction.depositAmount > 0)
}

function isDeferredServicePayment(transaction: Pick<Transaction, "paymentCollectionTiming">) {
  return transaction.paymentCollectionTiming === PaymentCollectionTiming.AFTER_SERVICE
}

function hasDeferredServicePaymentPending(transaction: FinanceTransaction) {
  return (
    needsServicePayment(transaction) &&
    isDeferredServicePayment(transaction) &&
    !transaction.servicePaymentRequestedAt &&
    !hasSuccessfulServicePayment(transaction)
  )
}

export function calculateCapturedDepositFeeBreakdown(amount: number): DepositFeeBreakdown {
  const stripeFeeAmount = Math.round(amount * 0.015) + 25
  const platformFeeAmount = Math.round(amount * 0.005)
  const vendorNetAmount = Math.max(0, amount - stripeFeeAmount - platformFeeAmount)

  return {
    stripeFeeAmount,
    platformFeeAmount,
    vendorNetAmount,
  }
}

export async function recordFinanceAuditLog(
  db: DatabaseClient,
  {
    actorId,
    actorType = AuditActorType.USER,
    action,
    entityType,
    entityId,
    metadata,
  }: FinanceAuditLogInput
) {
  return db.auditLog.create({
    data: {
      actorId: actorId ?? null,
      actorType,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata,
    },
  })
}

export function getNextFinanceStage(transaction: FinanceTransaction): FinanceStage {
  const requiresServicePayment = needsServicePayment(transaction)
  const requiresDepositAuthorization = needsDepositAuthorization(transaction)

  if (!requiresServicePayment && !requiresDepositAuthorization) {
    return "complete"
  }

  if (requiresDepositAuthorization && !hasAuthorizedDeposit(transaction)) {
    return "deposit_authorization"
  }

  if (requiresServicePayment && !hasSuccessfulServicePayment(transaction)) {
    if (hasDeferredServicePaymentPending(transaction)) {
      return "complete"
    }

    return "service_payment"
  }

  return "complete"
}

async function recordEmailSentEvent(db: DatabaseClient, transactionId: string, dedupeKey: string, detail: string) {
  await recordTransactionEvent(db, {
    transactionId,
    type: "EMAIL_SENT",
    title: "Email sent",
    detail,
    dedupeKey,
  })
}

async function sendCompletionNotifications(db: DatabaseClient, transaction: FinanceTransaction) {
  const vendorName = transaction.vendor?.businessName ?? "Conntrazy vendor"
  const locale = transaction.locale
  const vendorLocale = (transaction.vendor as (VendorProfile & { preferredLocale?: string | null }) | null)?.preferredLocale ?? locale
  const vendorLogoUrl = (transaction.vendor as (VendorProfile & { businessLogoUrl?: string | null }) | null)?.businessLogoUrl ?? null

  if (transaction.clientProfile?.email) {
    let documents: SubmittedDoc[] = []
    try {
      const rawDocs = await db.documentAsset.findMany({
        where: { transactionId: transaction.id },
        include: { requirement: { select: { label: true, type: true, fileSlotLabels: true } } },
        orderBy: [{ requirementId: "asc" }, { slotIndex: "asc" }],
      })
      documents = rawDocs.map((d) => {
        const slotLabels = d.requirement?.fileSlotLabels as Record<string, string> | null
        return {
          label: d.requirement?.label ?? d.label,
          type: d.requirement?.type ?? d.type,
          slotLabel: slotLabels ? slotLabels[String(d.slotIndex)] ?? null : d.slotLabel,
          fileName: d.fileName,
          assetUrl: d.assetUrl,
          textValue: d.textValue,
        } satisfies SubmittedDoc
      })
    } catch {
      // Non-blocking — send email without document list if query fails
    }

    const signedPdfPublicId = transaction.contractArtifact?.signedPdfPublicId
    const signedAgreementUrl = signedPdfPublicId
      ? `${getSiteUrl()}/api/integrations/cloudinary/download?publicId=${encodeURIComponent(signedPdfPublicId)}&resourceType=raw&format=pdf&fileName=${encodeURIComponent(`${transaction.reference}-signed.pdf`)}`
      : null

    const sent = await sendTransactionCompletedEmail(
      transaction.clientProfile.email,
      transaction.clientProfile.fullName,
      vendorName,
      transaction.reference,
      signedAgreementUrl,
      locale,
      vendorLogoUrl,
      documents
    )

    if (sent) {
      await recordEmailSentEvent(
        db,
        transaction.id,
        `email:completed:${transaction.id}:${transaction.clientProfile.email.toLowerCase()}`,
        `Completion receipt sent to ${transaction.clientProfile.email}.`
      )
    }
  }

  if (transaction.vendor?.businessEmail && transaction.clientProfile) {
    const signedPdfPublicId = transaction.contractArtifact?.signedPdfPublicId
    const signedAgreementUrl = signedPdfPublicId
      ? `${getSiteUrl()}/api/integrations/cloudinary/download?publicId=${encodeURIComponent(signedPdfPublicId)}&resourceType=raw&format=pdf&fileName=${encodeURIComponent(`${transaction.reference}-signed.pdf`)}`
      : null

    let vendorDocuments: SubmittedDoc[] = []
    try {
      const rawDocs = await db.documentAsset.findMany({
        where: { transactionId: transaction.id },
        include: { requirement: { select: { label: true, type: true, fileSlotLabels: true } } },
        orderBy: [{ requirementId: "asc" }, { slotIndex: "asc" }],
      })
      vendorDocuments = rawDocs.map((d) => {
        const slotLabels = d.requirement?.fileSlotLabels as Record<string, string> | null
        return {
          label: d.requirement?.label ?? d.label,
          type: d.requirement?.type ?? d.type,
          slotLabel: slotLabels ? slotLabels[String(d.slotIndex)] ?? null : d.slotLabel,
          fileName: d.fileName,
          assetUrl: d.assetUrl,
          textValue: d.textValue,
        } satisfies SubmittedDoc
      })
    } catch {
      // Non-blocking
    }

    const vendorSent = await sendVendorTransactionCompletedEmail({
      to: transaction.vendor.businessEmail,
      vendorName,
      clientName: transaction.clientProfile.fullName,
      clientEmail: transaction.clientProfile.email,
      clientPhone: transaction.clientProfile.phone ?? null,
      clientCompany: transaction.clientProfile.companyName ?? null,
      transactionReference: transaction.reference,
      transactionTitle: transaction.title,
      serviceDate: transaction.serviceDate ?? null,
      amount: transaction.amount ?? null,
      depositAmount: transaction.depositAmount ?? null,
      currency: transaction.currency,
      notes: transaction.notes ?? null,
      signedAgreementUrl,
      documents: vendorDocuments,
      locale: vendorLocale,
      vendorLogoUrl,
    })

    if (vendorSent) {
      await recordEmailSentEvent(
        db,
        transaction.id,
        `email:vendor-completed:${transaction.id}:${transaction.vendor.businessEmail.toLowerCase()}`,
        `Completion summary sent to vendor at ${transaction.vendor.businessEmail}.`
      )
    }
  }

  if (transaction.depositAmount && transaction.depositAmount > 0 && transaction.vendor?.businessEmail && transaction.clientProfile?.fullName) {
    const sent = await sendVendorDepositAlert(
      transaction.vendor.businessEmail,
      vendorName,
      transaction.clientProfile.fullName,
      transaction.depositAmount,
      vendorLocale,
      vendorLogoUrl
    )

    if (sent) {
      await recordEmailSentEvent(
        db,
        transaction.id,
        `email:deposit-authorized:${transaction.id}:${transaction.vendor.businessEmail.toLowerCase()}`,
        `Deposit authorization notice sent to ${transaction.vendor.businessEmail}.`
      )
    }
  }
}

async function markTransactionCompleted(db: DatabaseClient, transaction: FinanceTransaction) {
  if (transaction.status !== TransactionStatus.COMPLETED) {
    await db.transaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.COMPLETED },
    })
  }

  if (transaction.link && !transaction.link.completedAt) {
    await markTransactionLinkCompleted(db, {
      linkId: transaction.link.id,
      transactionId: transaction.id,
    })
  }

  await recordTransactionEvent(db, {
    transactionId: transaction.id,
    type: "COMPLETED",
    title: "Transaction completed",
    detail: "All required customer steps were finished.",
    dedupeKey: `event:completed:${transaction.id}`,
  })

  await sendCompletionNotifications(db, transaction)
}

async function markClientOnboardingCompleted(db: DatabaseClient, transaction: FinanceTransaction) {
  if (!transaction.customerCompletedAt) {
    await db.transaction.update({
      where: { id: transaction.id },
      data: { customerCompletedAt: new Date() },
    })
  }

  await recordTransactionEvent(db, {
    transactionId: transaction.id,
    type: "LINK_UPDATED",
    title: "Client onboarding completed",
    detail: "The client finished the agreement flow. The service payment can be requested later from the vendor dashboard.",
    dedupeKey: `event:customer-completed:${transaction.id}`,
  })

  await sendCompletionNotifications(db, transaction)
}

export async function completeTransactionWithoutPayment(db: DatabaseClient, transactionId: string) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: {
      link: true,
      vendor: true,
      clientProfile: true,
      payments: true,
      depositAuthorization: true,
      contractArtifact: true,
    },
  })

  if (!transaction) {
    return null
  }

  if (getNextFinanceStage(transaction) !== "complete") {
    return transaction
  }

  if (hasDeferredServicePaymentPending(transaction)) {
    await markClientOnboardingCompleted(db, transaction)
    return transaction
  }

  await markTransactionCompleted(db, transaction)

  return transaction
}

export async function syncTransactionFinanceState(db: DatabaseClient, transactionId: string) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: {
      link: true,
      vendor: true,
      clientProfile: true,
      payments: true,
      depositAuthorization: true,
      contractArtifact: true,
    },
  })

  if (!transaction) {
    return null
  }

  const nextStage = getNextFinanceStage(transaction)

  if (nextStage === "complete") {
    if (hasDeferredServicePaymentPending(transaction)) {
      await markClientOnboardingCompleted(db, transaction)
      return transaction
    }

    await markTransactionCompleted(db, transaction)
    return transaction
  }

  if (transaction.status !== TransactionStatus.PAYMENT_AUTHORIZED) {
    await db.transaction.update({
      where: { id: transaction.id },
      data: { status: TransactionStatus.PAYMENT_AUTHORIZED },
    })
  }

  return transaction
}

export async function upsertServicePayment(
  db: DatabaseClient,
  transactionId: string,
  session: Stripe.Checkout.Session
) {
  const amount = session.amount_total ?? 0
  const currency = (session.currency ?? "eur").toUpperCase()
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null

  await db.payment.upsert({
    where: {
      transactionId_kind: {
        transactionId,
        kind: PaymentKind.SERVICE_PAYMENT,
      },
    },
    update: {
      status: PaymentStatus.SUCCEEDED,
      amount,
      currency,
      stripeFeeAmount: 0,
      platformFeeAmount: 0,
      vendorNetAmount: amount,
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
    create: {
      transactionId,
      kind: PaymentKind.SERVICE_PAYMENT,
      status: PaymentStatus.SUCCEEDED,
      amount,
      currency,
      stripeFeeAmount: 0,
      platformFeeAmount: 0,
      vendorNetAmount: amount,
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
  })

  await recordTransactionEvent(db, {
    transactionId,
    type: "SERVICE_PAYMENT_SUCCEEDED",
    title: "Service payment collected",
    detail: `${currency} ${(amount / 100).toFixed(2)} captured successfully.`,
    dedupeKey: `event:service-payment:${transactionId}:${paymentIntentId ?? session.id}`,
    metadata: {
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      stripeFeeAmount: 0,
      platformFeeAmount: 0,
      vendorNetAmount: amount,
    },
  })
}

export async function upsertDepositAuthorization(
  db: DatabaseClient,
  transactionId: string,
  session: Stripe.Checkout.Session
) {
  const amount = session.amount_total ?? 0
  const currency = (session.currency ?? "eur").toUpperCase()
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null

  await db.depositAuthorization.upsert({
    where: { transactionId },
    update: {
      status: PaymentStatus.AUTHORIZED,
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      authorizedAt: new Date(),
    },
    create: {
      transactionId,
      status: PaymentStatus.AUTHORIZED,
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      authorizedAt: new Date(),
    },
  })

  await db.payment.upsert({
    where: {
      transactionId_kind: {
        transactionId,
        kind: PaymentKind.DEPOSIT_AUTHORIZATION,
      },
    },
    update: {
      status: PaymentStatus.AUTHORIZED,
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
    create: {
      transactionId,
      kind: PaymentKind.DEPOSIT_AUTHORIZATION,
      status: PaymentStatus.AUTHORIZED,
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
  })

  await recordTransactionEvent(db, {
    transactionId,
    type: "DEPOSIT_AUTHORIZED",
    title: "Deposit hold authorized",
    detail: `${currency} ${(amount / 100).toFixed(2)} placed on hold.`,
    dedupeKey: `event:deposit-authorized:${transactionId}:${paymentIntentId ?? session.id}`,
    metadata: {
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      status: PaymentStatus.AUTHORIZED,
    },
  })
}

export async function upsertServicePaymentFromIntent(
  db: DatabaseClient,
  transactionId: string,
  intent: Stripe.PaymentIntent
) {
  const amount = intent.amount
  const currency = intent.currency.toUpperCase()
  const paymentIntentId = intent.id

  await db.payment.upsert({
    where: { transactionId_kind: { transactionId, kind: PaymentKind.SERVICE_PAYMENT } },
    update: {
      status: PaymentStatus.SUCCEEDED,
      amount,
      currency,
      stripeFeeAmount: 0,
      platformFeeAmount: 0,
      vendorNetAmount: amount,
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
    create: {
      transactionId,
      kind: PaymentKind.SERVICE_PAYMENT,
      status: PaymentStatus.SUCCEEDED,
      amount,
      currency,
      stripeFeeAmount: 0,
      platformFeeAmount: 0,
      vendorNetAmount: amount,
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
  })

  await recordTransactionEvent(db, {
    transactionId,
    type: "SERVICE_PAYMENT_SUCCEEDED",
    title: "Service payment collected",
    detail: `${currency} ${(amount / 100).toFixed(2)} captured successfully.`,
    dedupeKey: `event:service-payment:${transactionId}:${paymentIntentId}`,
    metadata: {
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      stripeFeeAmount: 0,
      platformFeeAmount: 0,
      vendorNetAmount: amount,
    },
  })
}

export async function upsertDepositAuthorizationFromIntent(
  db: DatabaseClient,
  transactionId: string,
  intent: Stripe.PaymentIntent
) {
  const amount = intent.amount
  const currency = intent.currency.toUpperCase()
  const paymentIntentId = intent.id

  await db.depositAuthorization.upsert({
    where: { transactionId },
    update: { status: PaymentStatus.AUTHORIZED, amount, currency, stripeIntentId: paymentIntentId, authorizedAt: new Date() },
    create: { transactionId, status: PaymentStatus.AUTHORIZED, amount, currency, stripeIntentId: paymentIntentId, authorizedAt: new Date() },
  })

  await db.payment.upsert({
    where: { transactionId_kind: { transactionId, kind: PaymentKind.DEPOSIT_AUTHORIZATION } },
    update: { status: PaymentStatus.AUTHORIZED, amount, currency, stripeIntentId: paymentIntentId, processedAt: new Date() },
    create: { transactionId, kind: PaymentKind.DEPOSIT_AUTHORIZATION, status: PaymentStatus.AUTHORIZED, amount, currency, stripeIntentId: paymentIntentId, processedAt: new Date() },
  })

  await recordTransactionEvent(db, {
    transactionId,
    type: "DEPOSIT_AUTHORIZED",
    title: "Deposit hold authorized",
    detail: `${currency} ${(amount / 100).toFixed(2)} placed on hold.`,
    dedupeKey: `event:deposit-authorized:${transactionId}:${paymentIntentId}`,
    metadata: {
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      status: PaymentStatus.AUTHORIZED,
    },
  })
}

export async function upsertDepositChargeFromIntent(
  db: DatabaseClient,
  transactionId: string,
  intent: Stripe.PaymentIntent
) {
  const amount = intent.amount
  const currency = intent.currency.toUpperCase()
  const paymentIntentId = intent.id
  const autoRefundAtStr = intent.metadata?.depositAutoRefundAt
  const autoRefundAt = autoRefundAtStr ? new Date(autoRefundAtStr) : null

  // Platform fee was already collected via application_fee_amount at charge time.
  const platformFeeAmount = intent.metadata?.depositPlatformFeeAmount
    ? parseInt(intent.metadata.depositPlatformFeeAmount, 10)
    : Math.round(amount * 0.005)
  const stripeFeeAmount = Math.round(amount * 0.015) + 25
  const vendorNetAmount = Math.max(0, amount - stripeFeeAmount - platformFeeAmount)

  await db.depositAuthorization.upsert({
    where: { transactionId },
    update: {
      status: PaymentStatus.SUCCEEDED,
      depositStrategy: "CHARGE_REFUND",
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      authorizedAt: new Date(),
      depositChargedAt: new Date(),
      depositAutoRefundAt: autoRefundAt,
    },
    create: {
      transactionId,
      status: PaymentStatus.SUCCEEDED,
      depositStrategy: "CHARGE_REFUND",
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      authorizedAt: new Date(),
      depositChargedAt: new Date(),
      depositAutoRefundAt: autoRefundAt,
    },
  })

  await db.payment.upsert({
    where: { transactionId_kind: { transactionId, kind: PaymentKind.DEPOSIT_AUTHORIZATION } },
    update: {
      status: PaymentStatus.SUCCEEDED,
      amount,
      currency,
      stripeFeeAmount,
      platformFeeAmount,
      vendorNetAmount,
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
    create: {
      transactionId,
      kind: PaymentKind.DEPOSIT_AUTHORIZATION,
      status: PaymentStatus.SUCCEEDED,
      amount,
      currency,
      stripeFeeAmount,
      platformFeeAmount,
      vendorNetAmount,
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
  })

  const autoRefundNote = autoRefundAt
    ? ` Auto-refund scheduled for ${autoRefundAt.toISOString().slice(0, 10)}.`
    : ""

  await recordTransactionEvent(db, {
    transactionId,
    type: "DEPOSIT_CHARGED",
    title: "Deposit charged",
    detail: `${currency} ${(amount / 100).toFixed(2)} charged as deposit.${autoRefundNote}`,
    dedupeKey: `event:deposit-charged:${transactionId}:${paymentIntentId}`,
    metadata: {
      amount,
      currency,
      stripeIntentId: paymentIntentId,
      depositStrategy: "CHARGE_REFUND",
      depositAutoRefundAt: autoRefundAt?.toISOString() ?? null,
    },
  })
}

function getDepositReleaseDetail(
  currency: string,
  recordedAmount: number,
  reason?: DepositOutcomeReason
) {
  const amountLabel = `${currency} ${(recordedAmount / 100).toFixed(2)}`

  if (reason === "transaction_cancelled") {
    return `${amountLabel} released back to the client because the transaction was cancelled.`
  }

  if (reason === "admin_dispute_release") {
    return `${amountLabel} released back to the client after dispute resolution.`
  }

  return `${amountLabel} released back to the client.`
}

export async function recordDepositOutcome(
  db: DatabaseClient,
  {
    transactionId,
    amount,
    actualAmount,
    currency,
    stripeIntentId,
    action,
    vendorBusinessEmail,
    vendorBusinessName,
    clientFullName,
    clientEmail,
    reason,
    occurredAt,
    locale,
    vendorLocale,
    vendorLogoUrl,
  }: {
    transactionId: string
    amount: number
    actualAmount?: number
    currency: string
    stripeIntentId?: string | null
    action: "release" | "capture"
    vendorBusinessEmail?: string | null
    vendorBusinessName?: string | null
    clientFullName?: string | null
    clientEmail?: string | null
    reason?: DepositOutcomeReason
    occurredAt?: Date
    locale?: string
    vendorLocale?: string
    vendorLogoUrl?: string | null
  }
) {
  const paymentKind = action === "capture" ? PaymentKind.DEPOSIT_CAPTURE : PaymentKind.DEPOSIT_RELEASE
  const paymentStatus = action === "capture" ? PaymentStatus.CAPTURED : PaymentStatus.RELEASED
  const eventType = action === "capture" ? "DEPOSIT_CAPTURED" : "DEPOSIT_RELEASED"
  const title = action === "capture" ? "Deposit captured" : "Deposit released"
  const recordedAmount = actualAmount ?? amount
  const dedupeToken = stripeIntentId ?? `${action}:${reason ?? "local"}`
  const feeBreakdown =
    action === "capture" ? calculateCapturedDepositFeeBreakdown(recordedAmount) : null

  await db.payment.upsert({
    where: {
      transactionId_kind: {
        transactionId,
        kind: paymentKind,
      },
    },
    update: {
      status: paymentStatus,
      amount: recordedAmount,
      currency,
      stripeFeeAmount: feeBreakdown?.stripeFeeAmount ?? null,
      platformFeeAmount: feeBreakdown?.platformFeeAmount ?? null,
      vendorNetAmount: feeBreakdown?.vendorNetAmount ?? null,
      stripeIntentId: stripeIntentId ?? null,
      processedAt: new Date(),
    },
    create: {
      transactionId,
      kind: paymentKind,
      status: paymentStatus,
      amount: recordedAmount,
      currency,
      stripeFeeAmount: feeBreakdown?.stripeFeeAmount ?? null,
      platformFeeAmount: feeBreakdown?.platformFeeAmount ?? null,
      vendorNetAmount: feeBreakdown?.vendorNetAmount ?? null,
      stripeIntentId: stripeIntentId ?? null,
      processedAt: new Date(),
    },
  })

  await recordTransactionEvent(db, {
    transactionId,
    type: eventType,
    title,
    detail:
      action === "capture"
        ? `${currency} ${(recordedAmount / 100).toFixed(2)} captured. Stripe fee ${currency} ${((feeBreakdown?.stripeFeeAmount ?? 0) / 100).toFixed(2)}, platform fee ${currency} ${((feeBreakdown?.platformFeeAmount ?? 0) / 100).toFixed(2)}, vendor net ${currency} ${((feeBreakdown?.vendorNetAmount ?? 0) / 100).toFixed(2)}.`
        : getDepositReleaseDetail(currency, recordedAmount, reason),
    dedupeKey: `event:deposit-${action}:${transactionId}:${dedupeToken}`,
    occurredAt,
    metadata: {
      action,
      reason: reason ?? null,
      authorizedAmount: amount,
      processedAmount: recordedAmount,
      currency,
      stripeIntentId: stripeIntentId ?? null,
      stripeFeeAmount: feeBreakdown?.stripeFeeAmount ?? null,
      platformFeeAmount: feeBreakdown?.platformFeeAmount ?? null,
      vendorNetAmount: feeBreakdown?.vendorNetAmount ?? null,
      captureType:
        action === "capture"
          ? recordedAmount === amount
            ? "full"
            : "partial"
          : null,
    },
  })

  if (vendorBusinessEmail && clientFullName) {
    const sent = await sendVendorDepositStatusEmail(
      vendorBusinessEmail,
      vendorBusinessName ?? "Vendor",
      clientFullName,
      recordedAmount,
      currency,
      action === "capture" ? "captured" : "released",
      vendorLocale ?? locale,
      vendorLogoUrl
    )

    if (sent) {
      await recordEmailSentEvent(
        db,
        transactionId,
        `email:deposit-${action}:${transactionId}:${vendorBusinessEmail.toLowerCase()}`,
        `Deposit ${action} notice sent to ${vendorBusinessEmail}.`
      )
    }
  }

  if (clientEmail) {
    const sent = await sendCustomerDepositStatusEmail(
      clientEmail,
      clientFullName ?? "Customer",
      vendorBusinessName ?? "Vendor",
      recordedAmount,
      currency,
      action === "capture" ? "captured" : "released",
      locale,
      vendorLogoUrl
    )

    if (sent) {
      await recordEmailSentEvent(
        db,
        transactionId,
        `email:deposit-${action}:customer:${transactionId}:${clientEmail.toLowerCase()}`,
        `Deposit ${action} notice sent to ${clientEmail}.`
      )
    }
  }
}
