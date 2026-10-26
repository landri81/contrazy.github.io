import { randomBytes } from "node:crypto"
import type { CardSecurity, PostCharge, PostChargeStatus, PostChargeType, PrismaClient, Transaction, VendorProfile } from "@prisma/client"
import type Stripe from "stripe"

import { nextAction, type ChargeNextAction } from "@/features/card-security/retry-policy"
import { recordChargeOutcomeEvent, recordRefundSucceededEvent, type PartnerChargeOutcome } from "@/features/partner-webhooks/server/charge-events"
import type { StripeGateway } from "@/lib/integrations/stripe-gateway"
import { getSiteUrl } from "@/lib/site-url"

/** Charges whose amount comes from a third-party notice: the notice must be attached (Spec v2.1 §8). */
export const PROOF_REQUIRED_TYPES = new Set<PostChargeType>(["FPS", "TOLL", "TOWING"])

export class PostChargeError extends Error {
  constructor(
    readonly code: "card_not_secured" | "charge_window_closed" | "proof_required" | "charge_in_flight" | "charge_not_retryable" | "external_ref_conflict",
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

/** Spec v2.1 §9: one key per attempt, so a double click re-sends the same key and Stripe charges once. */
export function postChargeIdempotencyKey(postChargeId: string, attemptNo: number) {
  return `postcharge_${postChargeId}_attempt_${attemptNo}`
}

/**
 * New charges are allowed while the card is saved and the 90-day window has
 * not ended (Spec v2.1 §13). Before the return is recorded there is no end yet.
 * The end is an instant (return date-time + 90 days), so the boundary is exact
 * whatever the time zone.
 */
export function isChargeWindowOpen(card: Pick<CardSecurity, "status" | "windowEndsAt"> | null, now: Date) {
  return card?.status === "SECURED" && (!card.windowEndsAt || now.getTime() <= card.windowEndsAt.getTime())
}

type ChargeTransaction = Transaction & { vendor: VendorProfile; cardSecurity: CardSecurity | null }
type DatabaseClient = PrismaClient

export type PostChargeInput = {
  type: PostChargeType
  amount: number
  description?: string | null
  proofUrls?: string[]
  externalRef?: string | null
}

const OUTCOME_STATUS: Record<PartnerChargeOutcome, PostChargeStatus> = {
  succeeded: "SUCCEEDED",
  failed: "FAILED",
  requires_action: "REQUIRES_ACTION",
}

const HOUR_MS = 3_600_000

/** Where the customer pays (or updates the card) on session: `/{locale}/pay/{token}` on Contrazy. */
export function chargeLinkUrl(token: string, locale: string, baseUrl: string = getSiteUrl()) {
  return `${baseUrl.replace(/\/$/, "")}/${locale}/pay/${token}`
}

/** True when the customer must act through the link: pay on session, or give a new card first. */
export function linkKindFor(charge: Pick<PostCharge, "status" | "declineCode" | "attempt" | "paymentLinkToken">): "payment" | "card_update" | null {
  if (!charge.paymentLinkToken || (charge.status !== "FAILED" && charge.status !== "REQUIRES_ACTION")) {
    return null
  }

  return nextAction(charge.declineCode, charge.attempt).kind === "card_update_link" ? "card_update" : "payment"
}

/** The facts partner webhooks carry for a charge outcome (no card data). */
function chargeFacts(charge: PostCharge, attempt: number, declineCode: string | null, links: { locale: string; action: ChargeNextAction | null }) {
  const url = charge.paymentLinkToken ? chargeLinkUrl(charge.paymentLinkToken, links.locale) : null

  return {
    id: charge.id,
    externalRef: charge.externalRef,
    type: charge.type.toLowerCase(),
    amount: charge.amount,
    currency: charge.currency,
    attempt,
    declineCode,
    nextRetryAt: charge.nextRetryAt,
    paymentLinkUrl: links.action?.kind === "payment_link" ? url : null,
    cardUpdateUrl: links.action?.kind === "card_update_link" ? url : null,
  }
}

/**
 * After a failed attempt, the Spec §9 policy decides: a later off-session
 * retry, or a link for the customer (payment on session, or a new card first),
 * flagged for review for lost / stolen / fraudulent cards.
 */
function followUpFor(charge: PostCharge, outcome: PartnerChargeOutcome, attemptNo: number, declineCode: string | null, now: Date) {
  if (outcome === "succeeded") {
    return { action: null, data: { nextRetryAt: null } }
  }

  const action = nextAction(declineCode, attemptNo)

  if (action.kind === "retry") {
    return { action, data: { nextRetryAt: new Date(now.getTime() + action.afterHours * HOUR_MS) } }
  }

  if (action.kind === "wait") {
    return { action, data: { nextRetryAt: null } }
  }

  return {
    action,
    data: {
      nextRetryAt: null,
      paymentLinkToken: charge.paymentLinkToken ?? randomBytes(24).toString("base64url"),
      ...(action.kind === "payment_link" && action.reviewFlag ? { reviewFlag: true } : {}),
    },
  }
}

/** Records the outcome of one attempt on the charge row, its attempt row and the timeline (charge.* webhook). */
async function recordAttemptOutcome(
  db: DatabaseClient,
  input: { charge: PostCharge; attemptNo: number; outcome: PartnerChargeOutcome; paymentIntentId: string | null; declineCode: string | null; key: string; now: Date }
) {
  const { charge, attemptNo, outcome } = input

  const followUp = followUpFor(charge, outcome, attemptNo, input.declineCode, input.now)

  return db.$transaction(async (tx) => {
    await tx.postChargeAttempt.upsert({
      where: { idempotencyKey: input.key },
      create: { postChargeId: charge.id, attemptNo, idempotencyKey: input.key, paymentIntentId: input.paymentIntentId, outcome, declineCode: input.declineCode },
      update: { paymentIntentId: input.paymentIntentId, outcome, declineCode: input.declineCode },
    })
    const updated = await tx.postCharge.update({
      where: { id: charge.id },
      data: {
        status: OUTCOME_STATUS[outcome],
        attempt: attemptNo,
        paymentIntentId: input.paymentIntentId ?? charge.paymentIntentId,
        declineCode: outcome === "succeeded" ? null : input.declineCode,
        succeededAt: outcome === "succeeded" ? input.now : null,
        ...followUp.data,
      },
    })
    const booking = await tx.transaction.findUnique({ where: { id: charge.transactionId }, select: { locale: true } })
    await recordChargeOutcomeEvent(tx, {
      transactionId: charge.transactionId,
      outcome,
      charge: chargeFacts(updated, attemptNo, outcome === "succeeded" ? null : input.declineCode, { locale: booking?.locale ?? "en", action: followUp.action }),
      occurredAt: input.now,
    })
    return updated
  })
}

/**
 * One off-session attempt of a charge (Spec v2.1 §7). The row is claimed
 * first (PROCESSING), so a second attempt cannot run while one is in flight.
 * If Stripe cannot be reached the attempt number is not used up: the next try
 * sends the same idempotency key, so a charge that did go through is never
 * repeated.
 */
export async function attemptPostCharge(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: { charge: PostCharge; card: CardSecurity; account: string; reference: string; now?: Date }
): Promise<PostCharge> {
  const { charge, card } = input
  const now = input.now ?? new Date()

  if (!card.paymentMethodId) {
    throw new PostChargeError("card_not_secured", "The customer has no saved card on this booking.")
  }

  const claimed = await db.postCharge.updateMany({
    where: { id: charge.id, status: { in: ["PENDING", "FAILED", "REQUIRES_ACTION"] }, attempt: charge.attempt },
    data: { status: "PROCESSING" },
  })

  if (claimed.count !== 1) {
    throw new PostChargeError("charge_in_flight", "An attempt of this charge is already in progress or it is settled.")
  }

  const attemptNo = charge.attempt + 1
  const key = postChargeIdempotencyKey(charge.id, attemptNo)
  let intent: Stripe.PaymentIntent

  try {
    intent = await gateway.payments.createPaymentIntent(
      {
        amount: charge.amount,
        currency: charge.currency.toLowerCase(),
        customer: card.stripeCustomerId,
        payment_method: card.paymentMethodId,
        off_session: true,
        confirm: true,
        payment_method_types: ["card"],
        description: `${charge.type.toLowerCase()} - booking ${input.reference}`,
        metadata: {
          transactionId: charge.transactionId,
          vendorId: charge.vendorId,
          postChargeId: charge.id,
          chargeType: charge.type.toLowerCase(),
          attempt: String(attemptNo),
          ...(charge.externalRef ? { externalRef: charge.externalRef } : {}),
        },
      },
      { account: input.account, idempotencyKey: key }
    )
  } catch (error) {
    const stripeError = error as { type?: string; code?: string; decline_code?: string; payment_intent?: Stripe.PaymentIntent }

    if (stripeError.type === "StripeCardError") {
      const declineCode = stripeError.decline_code ?? stripeError.code ?? "card_declined"
      const outcome: PartnerChargeOutcome = stripeError.code === "authentication_required" ? "requires_action" : "failed"
      return recordAttemptOutcome(db, { charge, attemptNo, outcome, paymentIntentId: stripeError.payment_intent?.id ?? null, declineCode, key, now })
    }

    // Unknown outcome (network, Stripe outage): free the row, keep the attempt number (same key next time).
    await db.postCharge.update({ where: { id: charge.id }, data: { status: charge.status } })
    throw error
  }

  if (intent.status === "succeeded") {
    return recordAttemptOutcome(db, { charge, attemptNo, outcome: "succeeded", paymentIntentId: intent.id, declineCode: null, key, now })
  }

  if (intent.status === "requires_action") {
    return recordAttemptOutcome(db, { charge, attemptNo, outcome: "requires_action", paymentIntentId: intent.id, declineCode: "authentication_required", key, now })
  }

  // processing: the payment_intent.* webhook settles it.
  await db.postChargeAttempt.upsert({
    where: { idempotencyKey: key },
    create: { postChargeId: charge.id, attemptNo, idempotencyKey: key, paymentIntentId: intent.id, outcome: "processing" },
    update: { paymentIntentId: intent.id, outcome: "processing" },
  })
  return db.postCharge.update({ where: { id: charge.id }, data: { attempt: attemptNo, paymentIntentId: intent.id } })
}

/**
 * Creates a post-rental charge and runs its first attempt. Hard rules only
 * (business caps stay in LOCAZ): saved card, window open, amount > 0, proof
 * for FPS / tolls / towing, LOCAZ's reference unique per booking.
 */
export async function createPostCharge(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: { transaction: ChargeTransaction; charge: PostChargeInput; createdById?: string | null; now?: Date }
): Promise<PostCharge> {
  const { transaction } = input
  const now = input.now ?? new Date()
  const card = transaction.cardSecurity

  if (!card || card.status !== "SECURED") {
    throw new PostChargeError("card_not_secured", "The customer has no saved card on this booking.")
  }

  if (!isChargeWindowOpen(card, now)) {
    throw new PostChargeError("charge_window_closed", "The 90-day window for charges on this card has ended.", { windowEndsAt: card.windowEndsAt?.toISOString() ?? null })
  }

  const proofUrls = input.charge.proofUrls ?? []

  if (PROOF_REQUIRED_TYPES.has(input.charge.type) && proofUrls.length === 0) {
    throw new PostChargeError("proof_required", `A ${input.charge.type.toLowerCase()} charge needs the notice or receipt attached (proofUrls).`)
  }

  if (input.charge.externalRef) {
    const existing = await db.postCharge.findUnique({ where: { transactionId_externalRef: { transactionId: transaction.id, externalRef: input.charge.externalRef } } })

    if (existing) {
      throw new PostChargeError("external_ref_conflict", "A charge with this externalRef already exists on the booking.", { chargeId: existing.id })
    }
  }

  const charge = await db.postCharge.create({
    data: {
      transactionId: transaction.id,
      vendorId: transaction.vendorId,
      externalRef: input.charge.externalRef ?? null,
      type: input.charge.type,
      amount: input.charge.amount,
      currency: transaction.currency,
      description: input.charge.description ?? null,
      proofUrls,
      createdById: input.createdById ?? null,
    },
  })

  return attemptPostCharge(db, gateway, { charge, card, account: transaction.vendor.stripeAccountId!, reference: transaction.reference, now })
}

/**
 * `payment_intent.succeeded | payment_failed | requires_action` for a charge
 * intent (metadata.postChargeId): settles an attempt that was still processing
 * or changed after the fact. Idempotent: an outcome already recorded is skipped.
 */
export async function applyPostChargeIntent(db: DatabaseClient, intent: Stripe.PaymentIntent, outcome: PartnerChargeOutcome, now: Date = new Date()) {
  const chargeId = intent.metadata?.postChargeId

  if (!chargeId) {
    return null
  }

  const charge = await db.postCharge.findUnique({ where: { id: chargeId } })

  if (!charge || charge.paymentIntentId !== intent.id || charge.status === OUTCOME_STATUS[outcome] || charge.status === "REFUNDED" || charge.status === "PARTIALLY_REFUNDED") {
    return charge
  }

  // A succeeded charge never goes back to failed (late failure events of an earlier attempt).
  if (charge.status === "SUCCEEDED") {
    return charge
  }

  const attemptNo = Number(intent.metadata?.attempt ?? charge.attempt) || charge.attempt
  const declineCode = outcome === "succeeded" ? null : (intent.last_payment_error?.decline_code ?? intent.last_payment_error?.code ?? null)

  return recordAttemptOutcome(db, { charge, attemptNo, outcome, paymentIntentId: intent.id, declineCode, key: postChargeIdempotencyKey(charge.id, attemptNo), now })
}

/**
 * Hourly job: retries the charges whose off-session retry is due (Spec v2.1 §9:
 * soft declines up to 3 times, a generic decline once). Each retry is a new
 * attempt with its own idempotency key; the outcome schedules the next step.
 */
export async function retryDuePostCharges(db: DatabaseClient, gateway: StripeGateway, now: Date = new Date(), limit = 50) {
  const due = await db.postCharge.findMany({
    where: { status: "FAILED", nextRetryAt: { lte: now } },
    include: { transaction: { include: { cardSecurity: true, vendor: { select: { stripeAccountId: true } } } } },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  })
  const summary = { due: due.length, succeeded: 0, failed: 0, skipped: 0 }

  for (const charge of due) {
    const { transaction, ...row } = charge
    const card = transaction.cardSecurity
    const account = transaction.vendor.stripeAccountId

    if (!card || card.status !== "SECURED" || !account) {
      // No usable card any more: stop retrying; the charge stays failed for LOCAZ to handle.
      await db.postCharge.update({ where: { id: charge.id }, data: { nextRetryAt: null } })
      summary.skipped++
      continue
    }

    try {
      const result = await attemptPostCharge(db, gateway, { charge: row, card, account, reference: transaction.reference, now })
      if (result.status === "SUCCEEDED") summary.succeeded++
      else summary.failed++
    } catch (error) {
      summary.skipped++
      console.error("Post-charge retry skipped", { chargeId: charge.id, error: error instanceof Error ? error.message : "Unknown error" })
    }
  }

  return summary
}

export class PostChargeRefundError extends Error {
  constructor(
    readonly code: "charge_not_refundable" | "refund_too_large",
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

function refundedStatus(charge: Pick<PostCharge, "amount">, refundedAmount: number): PostChargeStatus {
  return refundedAmount >= charge.amount ? "REFUNDED" : "PARTIALLY_REFUNDED"
}

/**
 * Refunds a charge, fully or partly (e.g. an FPS cancelled on appeal), always
 * at Stripe, never in the database only (Spec v2.1 §11). The reason is
 * mandatory. A refunded amount no longer counts against LOCAZ's caps. The
 * Stripe key is per charge and already-refunded amount, so a re-sent request
 * refunds once.
 */
export async function refundPostCharge(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: { charge: PostCharge; account: string; amount?: number | null; reason: string; createdById?: string | null; now?: Date }
) {
  const { charge } = input

  if ((charge.status !== "SUCCEEDED" && charge.status !== "PARTIALLY_REFUNDED") || !charge.paymentIntentId) {
    throw new PostChargeRefundError("charge_not_refundable", "Only a charge that went through can be refunded.", { status: charge.status.toLowerCase() })
  }

  const remaining = charge.amount - charge.refundedAmount
  const amount = input.amount ?? remaining

  if (amount <= 0 || amount > remaining) {
    throw new PostChargeRefundError("refund_too_large", "The refund cannot exceed what is left on the charge.", { refundable: remaining })
  }

  const refund = await gateway.payments.createRefund(
    { payment_intent: charge.paymentIntentId, amount, reason: "requested_by_customer", metadata: { postChargeId: charge.id, reason: input.reason.slice(0, 500) } },
    { account: input.account, idempotencyKey: `postcharge_refund_${charge.id}_${charge.refundedAmount}_${amount}` }
  )
  const now = input.now ?? new Date()

  return db.$transaction(async (tx) => {
    const existing = await tx.postChargeRefund.findUnique({ where: { stripeRefundId: refund.id } })

    if (existing) {
      return { charge: await tx.postCharge.findUniqueOrThrow({ where: { id: charge.id } }), refund: existing }
    }

    const row = await tx.postChargeRefund.create({
      data: { postChargeId: charge.id, amount: refund.amount, reason: input.reason, stripeRefundId: refund.id, createdById: input.createdById ?? null },
    })
    const refundedAmount = charge.refundedAmount + refund.amount
    const updated = await tx.postCharge.update({ where: { id: charge.id }, data: { refundedAmount, status: refundedStatus(charge, refundedAmount) } })

    await recordRefundSucceededEvent(tx, {
      transactionId: charge.transactionId,
      refund: { id: row.id, chargeId: charge.id, amount: refund.amount, currency: charge.currency, reason: input.reason },
      occurredAt: now,
    })
    return { charge: updated, refund: row }
  })
}

/**
 * `charge.refunded` for a charge intent: brings the refunded amount in line
 * with Stripe, including refunds made by hand in the Stripe dashboard (each
 * new Stripe refund gets its row and its refund.succeeded event).
 */
export async function reconcilePostChargeRefunds(db: DatabaseClient, stripeCharge: Stripe.Charge) {
  const paymentIntentId = typeof stripeCharge.payment_intent === "string" ? stripeCharge.payment_intent : stripeCharge.payment_intent?.id

  if (!paymentIntentId) {
    return null
  }

  const charge = await db.postCharge.findUnique({ where: { paymentIntentId } })

  if (!charge) {
    return null
  }

  for (const refund of stripeCharge.refunds?.data ?? []) {
    if (refund.status !== "succeeded" && refund.status !== "pending") continue

    await db.$transaction(async (tx) => {
      if (await tx.postChargeRefund.findUnique({ where: { stripeRefundId: refund.id } })) return

      const current = await tx.postCharge.findUniqueOrThrow({ where: { id: charge.id } })
      const reason = refund.metadata?.reason || "Refunded in the Stripe dashboard"
      const row = await tx.postChargeRefund.create({ data: { postChargeId: charge.id, amount: refund.amount, reason, stripeRefundId: refund.id } })
      const refundedAmount = Math.min(current.amount, current.refundedAmount + refund.amount)

      await tx.postCharge.update({ where: { id: charge.id }, data: { refundedAmount, status: refundedStatus(current, refundedAmount) } })
      await recordRefundSucceededEvent(tx, {
        transactionId: charge.transactionId,
        refund: { id: row.id, chargeId: charge.id, amount: refund.amount, currency: charge.currency, reason },
      })
    })
  }

  return db.postCharge.findUnique({ where: { id: charge.id } })
}
