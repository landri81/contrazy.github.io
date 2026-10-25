import { createHash } from "node:crypto"
import type { CardSecurity, DepositAuthorization, Prisma, PrismaClient, Transaction, VendorProfile } from "@prisma/client"
import type Stripe from "stripe"

import { upsertDepositAuthorizationFromIntent } from "@/features/transactions/server/transaction-finance"
import { parseStepSwitches } from "@/features/transactions/step-switches"
import type { StripeGateway } from "@/lib/integrations/stripe-gateway"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

/** Card holds last about 7 days at the bank; past ~6 days of rental the hold expires before return (Spec v2.1 §5). */
export const PICKUP_HOLD_MAX_RENTAL_DAYS = 6
const DAY_MS = 86_400_000

export class PickupHoldError extends Error {
  constructor(
    readonly code: "card_not_secured" | "hold_exists" | "hold_not_recommended" | "hold_failed",
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

type HoldTransaction = Transaction & {
  vendor: VendorProfile
  cardSecurity: CardSecurity | null
  depositAuthorization: DepositAuthorization | null
}

/** Rental length in days (fractional) from the partner's start/end date-times, or null without dates. */
export function rentalLengthDays(transaction: Pick<Transaction, "startAt" | "endAt">) {
  return transaction.startAt && transaction.endAt ? (transaction.endAt.getTime() - transaction.startAt.getTime()) / DAY_MS : null
}

/**
 * Places the optional pre-authorization when the vehicle is handed over
 * (Spec v2.1 §5): a separate manual-capture PaymentIntent, off session, on the
 * card saved at booking (C5a). It is stored as the booking's deposit hold, so
 * the vendor dashboard, the partner API and the `booking.hold_*` webhooks show
 * it, and it is captured or released like any deposit hold.
 *
 * Refused: no secured card (409 card_not_secured), a hold already on the
 * booking or a deposit step in the customer flow (409 hold_exists), a rental
 * longer than 6 days without `force` (409 hold_not_recommended: the hold would
 * expire before return; the saved card covers later charges). A declined or
 * 3DS-requiring card is 402 hold_failed with Stripe's decline code: no retry
 * off session.
 */
export async function placePickupHold(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: { transaction: HoldTransaction; amount: number; force?: boolean; idempotencyKey: string }
): Promise<DepositAuthorization> {
  const { transaction } = input
  const card = transaction.cardSecurity

  if (!card || card.status !== "SECURED" || !card.paymentMethodId) {
    throw new PickupHoldError("card_not_secured", "The customer has not saved a card on this booking yet.")
  }

  const existing = transaction.depositAuthorization

  if (parseStepSwitches(transaction.stepSwitches)?.hold || (existing && existing.status !== "RELEASED" && existing.status !== "FAILED" && existing.status !== "CANCELLED")) {
    throw new PickupHoldError("hold_exists", "This booking already has a deposit hold.", existing ? { holdStatus: existing.status.toLowerCase() } : {})
  }

  const days = rentalLengthDays(transaction)

  if (!input.force && days !== null && days > PICKUP_HOLD_MAX_RENTAL_DAYS) {
    throw new PickupHoldError(
      "hold_not_recommended",
      `This rental lasts ${Math.ceil(days)} days: a card hold expires after about 7 days, before the vehicle is back. Rely on the saved card, or send force: true.`,
      { rentalDays: Math.round(days * 10) / 10, maxRentalDays: PICKUP_HOLD_MAX_RENTAL_DAYS }
    )
  }

  const account = transaction.vendor.stripeAccountId!
  const keyDigest = createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 32)
  let intent: Stripe.PaymentIntent

  try {
    intent = await gateway.payments.createPaymentIntent(
      {
        amount: input.amount,
        currency: transaction.currency.toLowerCase(),
        customer: card.stripeCustomerId,
        payment_method: card.paymentMethodId,
        capture_method: "manual",
        off_session: true,
        confirm: true,
        payment_method_types: ["card"],
        description: `${transaction.title}: pickup deposit hold (${transaction.reference})`,
        metadata: {
          transactionId: transaction.id,
          vendorId: transaction.vendorId,
          financeStage: "deposit_authorization",
          pickupHold: "true",
          ...(transaction.externalRef ? { externalRef: transaction.externalRef } : {}),
        },
      },
      { account, idempotencyKey: `pickup-hold:${transaction.id}:${keyDigest}` }
    )
  } catch (error) {
    const card = error as { type?: string; code?: string; decline_code?: string; message?: string }

    if (card.type === "StripeCardError") {
      throw new PickupHoldError("hold_failed", card.message ?? "The card was declined.", {
        declineCode: card.decline_code ?? card.code ?? null,
        requiresAction: card.code === "authentication_required",
      })
    }

    throw error
  }

  if (intent.status !== "requires_capture") {
    throw new PickupHoldError("hold_failed", "The card hold was not authorized.", { stripeStatus: intent.status })
  }

  await upsertDepositAuthorizationFromIntent(db, transaction.id, intent)
  return db.depositAuthorization.findUniqueOrThrow({ where: { transactionId: transaction.id } })
}
