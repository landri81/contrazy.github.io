import { NextResponse } from "next/server"
import { AuditActorType, PaymentKind } from "@prisma/client"

import { clientFlowTransactionInclude, getNextClientStep } from "@/features/client-flow/server/client-flow-data"
import { recordFinanceAuditLog } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { sendDeferredServicePaymentRequestEmail } from "@/lib/integrations/resend"
import { getAppBaseUrl } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { dbUser, session, vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }
    const actorType =
      session.user.role === "SUPER_ADMIN" ? AuditActorType.SUPER_ADMIN : AuditActorType.USER

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, vendorId: vendorProfile.id },
      include: clientFlowTransactionInclude,
    })

    if (!transaction?.link) {
      return NextResponse.json({ success: false, message: "Transaction not found." }, { status: 404 })
    }

    if (transaction.paymentCollectionTiming !== "AFTER_SERVICE" || !transaction.amount || transaction.amount <= 0) {
      return NextResponse.json(
        { success: false, message: "This transaction is not configured for deferred service payment." },
        { status: 422 }
      )
    }

    const existingServicePayment = transaction.payments.some(
      (payment) =>
        payment.kind === PaymentKind.SERVICE_PAYMENT &&
        (payment.status === "SUCCEEDED" || payment.status === "CAPTURED")
    )

    if (existingServicePayment) {
      return NextResponse.json(
        { success: false, message: "The service payment has already been collected." },
        { status: 422 }
      )
    }

    if (transaction.servicePaymentRequestedAt) {
      return NextResponse.json({ success: true, alreadyRequested: true })
    }

    if (getNextClientStep(transaction) !== "complete") {
      return NextResponse.json(
        { success: false, message: "The client must complete the onboarding flow before you can request payment." },
        { status: 422 }
      )
    }

    const requestedAt = new Date()

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { servicePaymentRequestedAt: requestedAt },
    })

    await recordTransactionEvent(prisma, {
      transactionId: transaction.id,
      type: "SERVICE_PAYMENT_REQUESTED",
      title: "Deferred service payment requested",
      detail: `The vendor requested the service payment after onboarding completion.`,
      occurredAt: requestedAt,
      dedupeKey: `event:service-payment-requested:${transaction.id}`,
      metadata: {
        requestedAt: requestedAt.toISOString(),
        amount: transaction.amount,
        currency: transaction.currency,
        paymentCollectionTiming: transaction.paymentCollectionTiming,
      },
    })

    await recordFinanceAuditLog(prisma, {
      actorId: dbUser.id,
      actorType,
      action: "Requested deferred service payment",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: {
        transactionId: transaction.id,
        requestedAt: requestedAt.toISOString(),
        amount: transaction.amount,
        currency: transaction.currency,
        paymentCollectionTiming: transaction.paymentCollectionTiming,
      },
    })

    if (transaction.clientProfile?.email) {
      const paymentUrl = `${getAppBaseUrl()}/t/${transaction.link.token}/payment`
      const sent = await sendDeferredServicePaymentRequestEmail(
        transaction.clientProfile.email,
        transaction.clientProfile.fullName,
        transaction.vendor?.businessName ?? "Vendor",
        transaction.reference,
        transaction.amount,
        transaction.currency,
        paymentUrl
      )

      if (sent) {
        await recordTransactionEvent(prisma, {
          transactionId: transaction.id,
          type: "EMAIL_SENT",
          title: "Email sent",
          detail: `Deferred payment request sent to ${transaction.clientProfile.email}.`,
          dedupeKey: `email:service-payment-requested:${transaction.id}:${transaction.clientProfile.email.toLowerCase()}`,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Request Service Payment Error:", error)
    return NextResponse.json({ success: false, message: "Failed to request service payment." }, { status: 500 })
  }
}
