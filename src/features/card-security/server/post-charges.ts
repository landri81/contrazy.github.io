import type { CardSecurity, PostCharge, PostChargeStatus, PostChargeType, PrismaClient, Transaction, VendorProfile } from "@prisma/client"
import type Stripe from "stripe"

import { recordChargeOutcomeEvent, type PartnerChargeOutcome } from "@/features/partner-webhooks/server/charge-events"
import type { StripeGateway } from "@/lib/integrations/stripe-gateway"

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

/** The facts partner webhooks carry for a charge outcome (no card data). */
function chargeFacts(charge: PostCharge, attempt: number, declineCode: string | null) {
  return {
    id: charge.id,
    externalRef: charge.externalRef,
    type: charge.type.toLowerCase(),
    amount: charge.amount,
    currency: charge.currency,
    attempt,
    declineCode,
  }
}

/** Records the outcome of one attempt on the charge row, its attempt row and the timeline (charge.* webhook). */
async function recordAttemptOutcome(
  db: DatabaseClient,
  input: { charge: PostCharge; attemptNo: number; outcome: PartnerChargeOutcome; paymentIntentId: string | null; declineCode: string | null; key: string; now: Date }
) {
  const { charge, attemptNo, outcome } = input

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
      },
    })
    await recordChargeOutcomeEvent(tx, {
      transactionId: charge.transactionId,
      outcome,
      charge: chargeFacts(updated, attemptNo, outcome === "succeeded" ? null : input.declineCode),
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
