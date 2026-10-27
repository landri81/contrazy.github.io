import { hasSecuredCard, isCardSecurityRequired } from "@/features/card-security/card-security-state"
import { ensurePartnerCustomer, findCardConsent, trackPendingCardSecurity } from "@/features/card-security/server/card-security"
import { getDepositAutoRefundDays, getDepositStrategy } from "@/features/subscriptions/server/deposit-strategy"
import { getNextFinanceStage, type FinanceTransaction } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { markTransactionLinkOpened, type getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"
import { getConnectedAccountRequestOptions, getStripePublishableKey, stripe, stripeGateway } from "@/lib/integrations/stripe"

/**
 * The payment step's start (shared, M10): the PaymentIntent of the next money stage (deposit hold or charge, then the
 * rental payment, which also saves the card when the booking keeps it, after consent) on the vendor's connected
 * account. Contrazy's page and the partner API's embedded checkout call it; `redirect` means nothing is to be paid now.
 */

type ActiveLink = Extract<Awaited<ReturnType<typeof getClientLinkAccessContext>>, { state: "active" }>["link"]

export type PaymentStartResult = {
  status: number
  body: {
    success: boolean
    message?: string
    code?: string
    /** Nothing to pay now: the page to go to instead. */
    redirect?: string
    clientSecret?: string | null
    stripeAccountId?: string | null
    publishableKey?: string
    amountCents?: number
    currency?: string
    isDeposit?: boolean
    paymentIntentId?: string
    depositStrategy?: string | null
    depositHoldDays?: number | null
    [field: string]: unknown
  }
}

export async function startClientPayment(linkContext: { link: ActiveLink }, token: string): Promise<PaymentStartResult> {
  await markTransactionLinkOpened(prisma, {
    linkId: linkContext.link.id,
    transactionId: linkContext.link.transaction.id,
  })

  const link = await prisma.transactionLink.findUnique({
    where: { id: linkContext.link.id },
    include: {
      transaction: {
        include: {
          vendor: {
            include: {
              subscription: true,
            },
          },
          clientProfile: true,
          payments: true,
          depositAuthorization: true,
          cardSecurity: true,
          contractArtifact: true,
        },
      },
    },
  })

  if (!link?.transaction?.vendor?.stripeAccountId) {
    return { status: 422, body: { success: false, message: "Payment configuration unavailable" } }
  }

  const { transaction } = link
  const financeTransaction: FinanceTransaction = {
    ...transaction,
    link,
    vendor: transaction.vendor,
    clientProfile: transaction.clientProfile,
    payments: transaction.payments,
    depositAuthorization: transaction.depositAuthorization,
    cardSecurity: transaction.cardSecurity,
    contractArtifact: transaction.contractArtifact,
  }

  const nextStage = getNextFinanceStage(financeTransaction)

  if (nextStage === "complete") {
    return {
      status: 200,
      body: {
        success: true,
        redirect: withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/complete`),
      },
    }
  }

  if (nextStage === "card_security") {
    // Nothing to charge now: the page shows the "card as security only" form instead.
    return {
      status: 200,
      body: {
        success: true,
        redirect: withLocalePath(normalizeLocale(transaction.locale), `/t/${token}/payment?stage=card`),
      },
    }
  }

  // Card security (C5): the rental payment also saves the card for later charges, after consent.
  const savesCard = nextStage === "service_payment" && isCardSecurityRequired(transaction) && !hasSecuredCard(transaction)

  if (savesCard && !(await findCardConsent(prisma, transaction.id))) {
    return { status: 409, body: { success: false, code: "consent_required", message: "Please accept the card terms first." } }
  }

  const partnerCustomer = savesCard
    ? await ensurePartnerCustomer(prisma, stripeGateway, {
        vendorId: transaction.vendorId,
        // Checked at the top of the route (422 without a connected account).
        stripeAccountId: transaction.vendor.stripeAccountId!,
        email: transaction.clientProfile?.email ?? "",
        name: transaction.clientProfile?.fullName ?? null,
        phone: transaction.clientProfile?.phone ?? null,
      })
    : null

  const isDeposit = nextStage === "deposit_authorization"
  const amountCents = isDeposit ? transaction.depositAmount! : transaction.amount!
  const stripeAccountId = transaction.vendor.stripeAccountId
  const subscription = transaction.vendor.subscription
  const depositHoldDays = transaction.depositHoldDays ?? 7

  const depositStrategy = isDeposit ? getDepositStrategy(subscription, depositHoldDays) : null
  const isChargeRefund = depositStrategy === "CHARGE_REFUND"

  const depositAutoRefundAt = isDeposit && isChargeRefund
    ? new Date(Date.now() + getDepositAutoRefundDays(subscription, depositHoldDays) * 24 * 60 * 60 * 1000).toISOString()
    : null

  const isFr = transaction.locale === "fr"
  const statementDescriptorSuffix = isDeposit && isChargeRefund
    ? (isFr ? "DEPOT GARANTIE" : "DEPOSIT")
    : undefined

  // For long CHARGE_REFUND deposits the platform fee (0.5%) is collected at charge time.
  // If the vendor later refunds the deposit, the platform fee remains the vendor cost.
  const depositPlatformFee = isDeposit && isChargeRefund
    ? Math.round(amountCents * 0.005)
    : undefined

  const intent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency: transaction.currency.toLowerCase(),
      capture_method: isDeposit && !isChargeRefund ? "manual" : "automatic",
      payment_method_types: ["card"],
      ...(partnerCustomer ? { customer: partnerCustomer.stripeCustomerId, setup_future_usage: "off_session" as const } : {}),
      ...(statementDescriptorSuffix ? { statement_descriptor_suffix: statementDescriptorSuffix } : {}),
      ...(depositPlatformFee ? { application_fee_amount: depositPlatformFee } : {}),
      metadata: {
        transactionId: transaction.id,
        vendorId: transaction.vendorId,
        kind: transaction.kind,
        financeStage: nextStage,
        token,
        ...(isDeposit && depositStrategy ? { depositStrategy } : {}),
        ...(depositAutoRefundAt ? { depositAutoRefundAt } : {}),
        ...(depositPlatformFee ? { depositPlatformFeeAmount: String(depositPlatformFee) } : {}),
        ...(isDeposit ? { depositHoldDays: String(depositHoldDays) } : {}),
        ...(partnerCustomer ? { cardSecurity: "true" } : {}),
      },
      description: `${transaction.title} — ${isDeposit ? "Security Deposit" : "Service Payment"} (${transaction.reference})`,
      receipt_email: transaction.clientProfile?.email ?? undefined,
    },
    getConnectedAccountRequestOptions(stripeAccountId)
  )

  if (partnerCustomer) {
    await trackPendingCardSecurity(prisma, { transactionId: transaction.id, partnerCustomer, paymentIntentId: intent.id })
  }

  await recordTransactionEvent(prisma, {
    transactionId: transaction.id,
    type: "PAYMENT_SESSION_CREATED",
    title: isDeposit
      ? isChargeRefund
        ? "Deposit charge started"
        : "Deposit authorization started"
      : "Service payment started",
    detail: `PaymentIntent ${intent.id} created for ${isDeposit ? (isChargeRefund ? "deposit charge" : "deposit hold") : "service payment"}.`,
    dedupeKey: `event:payment-intent:${transaction.id}:${nextStage}:${intent.id}`,
    metadata: {
      intentId: intent.id,
      financeStage: nextStage,
      depositStrategy: depositStrategy ?? null,
      depositHoldDays: isDeposit ? depositHoldDays : null,
      depositAutoRefundAt: depositAutoRefundAt ?? null,
    },
  })

  return {
    status: 200,
    body: {
      success: true,
      clientSecret: intent.client_secret,
      stripeAccountId,
      publishableKey: getStripePublishableKey(),
      financeStage: nextStage,
      amountCents,
      currency: transaction.currency,
      isDeposit,
      title: transaction.title,
      reference: transaction.reference,
      paymentIntentId: intent.id,
      depositStrategy: depositStrategy ?? null,
      depositHoldDays: isDeposit ? depositHoldDays : null,
      savesCard: Boolean(partnerCustomer),
    },
  }
}
