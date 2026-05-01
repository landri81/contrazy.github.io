import {
  PaymentKind,
  PaymentStatus,
  Prisma,
  PrismaClient,
  TransactionStatus,
  type DepositAuthorization,
  type Payment,
  type Transaction,
  type TransactionLink,
  type VendorProfile,
  type ClientProfile,
} from "@prisma/client"
import type Stripe from "stripe"

import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import {
  sendTransactionCompletedEmail,
  sendVendorDepositAlert,
  sendVendorDepositStatusEmail,
} from "@/lib/integrations/resend"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

export type FinanceStage = "none" | "service_payment" | "deposit_authorization" | "complete"

export type FinanceTransaction = Transaction & {
  link: TransactionLink | null
  payments: Payment[]
  depositAuthorization: DepositAuthorization | null
  vendor: VendorProfile | null
  clientProfile: ClientProfile | null
}

const authorizedDepositStatuses = new Set<PaymentStatus>([
  PaymentStatus.AUTHORIZED,
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

export function getNextFinanceStage(transaction: FinanceTransaction): FinanceStage {
  const needsServicePayment = Boolean(transaction.amount && transaction.amount > 0)
  const needsDepositAuthorization = Boolean(transaction.depositAmount && transaction.depositAmount > 0)

  if (!needsServicePayment && !needsDepositAuthorization) {
    return "complete"
  }

  if (needsServicePayment && !hasSuccessfulServicePayment(transaction)) {
    return "service_payment"
  }

  if (needsDepositAuthorization && !hasAuthorizedDeposit(transaction)) {
    return "deposit_authorization"
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

  if (transaction.clientProfile?.email) {
    const sent = await sendTransactionCompletedEmail(
      transaction.clientProfile.email,
      transaction.clientProfile.fullName,
      vendorName,
      transaction.reference
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

  if (transaction.depositAmount && transaction.depositAmount > 0 && transaction.vendor?.businessEmail && transaction.clientProfile?.fullName) {
    const sent = await sendVendorDepositAlert(
      transaction.vendor.businessEmail,
      vendorName,
      transaction.clientProfile.fullName,
      transaction.depositAmount
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
    await db.transactionLink.update({
      where: { id: transaction.link.id },
      data: { completedAt: new Date() },
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

export async function completeTransactionWithoutPayment(db: DatabaseClient, transactionId: string) {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: {
      link: true,
      vendor: true,
      clientProfile: true,
      payments: true,
      depositAuthorization: true,
    },
  })

  if (!transaction) {
    return null
  }

  if (getNextFinanceStage(transaction) !== "complete") {
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
    },
  })

  if (!transaction) {
    return null
  }

  const nextStage = getNextFinanceStage(transaction)

  if (nextStage === "complete") {
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
      stripeIntentId: paymentIntentId,
      processedAt: new Date(),
    },
    create: {
      transactionId,
      kind: PaymentKind.SERVICE_PAYMENT,
      status: PaymentStatus.SUCCEEDED,
      amount,
      currency,
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
  })
}

export async function recordDepositOutcome(
  db: DatabaseClient,
  {
    transactionId,
    amount,
    currency,
    stripeIntentId,
    action,
    vendorBusinessEmail,
    vendorBusinessName,
    clientFullName,
  }: {
    transactionId: string
    amount: number
    currency: string
    stripeIntentId: string
    action: "release" | "capture"
    vendorBusinessEmail?: string | null
    vendorBusinessName?: string | null
    clientFullName?: string | null
  }
) {
  const paymentKind = action === "capture" ? PaymentKind.DEPOSIT_CAPTURE : PaymentKind.DEPOSIT_RELEASE
  const paymentStatus = action === "capture" ? PaymentStatus.CAPTURED : PaymentStatus.RELEASED
  const eventType = action === "capture" ? "DEPOSIT_CAPTURED" : "DEPOSIT_RELEASED"
  const title = action === "capture" ? "Deposit captured" : "Deposit released"

  await db.payment.upsert({
    where: {
      transactionId_kind: {
        transactionId,
        kind: paymentKind,
      },
    },
    update: {
      status: paymentStatus,
      amount,
      currency,
      stripeIntentId,
      processedAt: new Date(),
    },
    create: {
      transactionId,
      kind: paymentKind,
      status: paymentStatus,
      amount,
      currency,
      stripeIntentId,
      processedAt: new Date(),
    },
  })

  await recordTransactionEvent(db, {
    transactionId,
    type: eventType,
    title,
    detail: `${currency} ${(amount / 100).toFixed(2)} ${action === "capture" ? "converted into a charge" : "released back to the client"}.`,
    dedupeKey: `event:deposit-${action}:${transactionId}:${stripeIntentId}`,
  })

  if (vendorBusinessEmail && clientFullName) {
    const sent = await sendVendorDepositStatusEmail(
      vendorBusinessEmail,
      vendorBusinessName ?? "Vendor",
      clientFullName,
      amount,
      action === "capture" ? "captured" : "released"
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
}
