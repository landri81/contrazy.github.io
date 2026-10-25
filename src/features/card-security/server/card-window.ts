import type { CardSecurity, PartnerCustomer, PostChargeStatus, Prisma, PrismaClient } from "@prisma/client"

import type { StripeGateway } from "@/lib/integrations/stripe-gateway"

type DatabaseClient = PrismaClient | Prisma.TransactionClient

/** LOCAZ may charge the saved card up to 90 days after the vehicle is returned (Spec v2.1 §1, §13). */
export const CARD_CHARGE_WINDOW_DAYS = 90
const DAY_MS = 86_400_000

export class CardWindowError extends Error {
  constructor(
    readonly code: "card_not_secured" | "card_detached" | "card_in_use",
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

/** A charge in flight, waiting for a retry or for the customer's payment link still needs the card. */
const OPEN_CHARGE_STATUSES: PostChargeStatus[] = ["PENDING", "PROCESSING", "FAILED", "REQUIRES_ACTION"]

export function chargeWindowEnd(returnedAt: Date) {
  return new Date(returnedAt.getTime() + CARD_CHARGE_WINDOW_DAYS * DAY_MS)
}

/**
 * The vehicle is back: the 90-day charge window starts from the return
 * date-time (`windowEndsAt = returnedAt + 90 days`). Can be corrected while
 * the card is still saved; a detached card has no window anymore.
 */
export async function markVehicleReturned(db: DatabaseClient, input: { transactionId: string; returnedAt: Date }): Promise<CardSecurity> {
  const card = await db.cardSecurity.findUnique({ where: { transactionId: input.transactionId } })

  if (!card || card.status === "PENDING") {
    throw new CardWindowError("card_not_secured", "The customer has not saved a card on this booking.")
  }

  if (card.status === "DETACHED") {
    throw new CardWindowError("card_detached", "The card of this booking was already detached.")
  }

  return db.cardSecurity.update({ where: { id: card.id }, data: { windowEndsAt: chargeWindowEnd(input.returnedAt) } })
}

/**
 * Bookings that still need the customer's saved card: the window is open (no
 * return recorded yet, or less than 90 days since it), a post-rental charge is
 * not settled yet (in flight, waiting for a retry or for the customer's link),
 * or a dispute is open on the booking. Detaching is refused while anything
 * blocks (Spec v2.1 §13, T9).
 */
export async function findCardBlockers(db: DatabaseClient, partnerCustomerId: string, now: Date) {
  const cards = await db.cardSecurity.findMany({
    where: {
      partnerCustomerId,
      status: "SECURED",
      OR: [
        { windowEndsAt: null },
        { windowEndsAt: { gt: now } },
        { transaction: { dispute: { status: { in: ["OPEN", "UNDER_REVIEW"] } } } },
        { transaction: { postCharges: { some: { status: { in: OPEN_CHARGE_STATUSES } } } } },
      ],
    },
    select: {
      transactionId: true,
      windowEndsAt: true,
      transaction: {
        select: {
          externalRef: true,
          dispute: { select: { status: true } },
          postCharges: { where: { status: { in: OPEN_CHARGE_STATUSES } }, select: { id: true }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  return cards.map((card) => ({
    bookingId: card.transactionId,
    externalRef: card.transaction.externalRef,
    reason: card.transaction.dispute && card.transaction.dispute.status !== "RESOLVED" && card.transaction.dispute.status !== "LOST"
      ? ("open_dispute" as const)
      : card.transaction.postCharges.length > 0
        ? ("open_charge" as const)
        : card.windowEndsAt
          ? ("charge_window_open" as const)
          : ("not_returned" as const),
    windowEndsAt: card.windowEndsAt,
  }))
}

async function detachAtStripe(gateway: StripeGateway, account: string, paymentMethodId: string) {
  try {
    await gateway.payments.detachPaymentMethod(paymentMethodId, { account })
  } catch (error) {
    // Already detached (by Stripe, the customer's bank or a previous run): nothing left to remove.
    if ((error as { code?: string }).code !== "payment_method_unexpected_state" && (error as { code?: string }).code !== "resource_missing") {
      throw error
    }
  }
}

async function detachCard(db: DatabaseClient, gateway: StripeGateway, account: string, card: Pick<CardSecurity, "id" | "paymentMethodId">, now: Date) {
  if (card.paymentMethodId) {
    await detachAtStripe(gateway, account, card.paymentMethodId)
  }

  await db.cardSecurity.update({ where: { id: card.id }, data: { status: "DETACHED", detachedAt: now } })
}

/**
 * Detaches every saved card of a customer (partner request), only when no
 * booking still needs it: otherwise 409 `card_in_use` with the blocking
 * bookings. The Stripe customer itself is kept for the next booking.
 */
export async function detachCustomerCards(
  db: DatabaseClient,
  gateway: StripeGateway,
  input: { partnerCustomer: PartnerCustomer; account: string; now?: Date }
) {
  const now = input.now ?? new Date()
  const blockers = await findCardBlockers(db, input.partnerCustomer.id, now)

  if (blockers.length > 0) {
    throw new CardWindowError("card_in_use", "A booking of this customer still needs the saved card.", {
      blockingBookings: blockers.map((b) => ({ id: b.bookingId, externalRef: b.externalRef, reason: b.reason, windowEndsAt: b.windowEndsAt?.toISOString() ?? null })),
    })
  }

  const cards = await db.cardSecurity.findMany({ where: { partnerCustomerId: input.partnerCustomer.id, status: "SECURED" }, select: { id: true, paymentMethodId: true } })

  for (const card of cards) {
    await detachCard(db, gateway, input.account, card, now)
  }

  return { detached: cards.length }
}

/**
 * Daily job (Spec v2.1 §13): once a booking's 90-day window has ended, its
 * card is detached unless a dispute is still open. Cards shared with another
 * booking that still needs them are kept (same PaymentMethod).
 */
export async function detachExpiredCards(db: DatabaseClient, gateway: StripeGateway, now: Date = new Date(), limit = 100) {
  const due = await db.cardSecurity.findMany({
    where: {
      status: "SECURED",
      windowEndsAt: { lte: now },
      NOT: {
        OR: [
          { transaction: { dispute: { status: { in: ["OPEN", "UNDER_REVIEW"] } } } },
          { transaction: { postCharges: { some: { status: { in: OPEN_CHARGE_STATUSES } } } } },
        ],
      },
    },
    select: { id: true, paymentMethodId: true, partnerCustomerId: true, transaction: { select: { vendor: { select: { stripeAccountId: true } } } } },
    orderBy: { windowEndsAt: "asc" },
    take: limit,
  })
  const summary = { due: due.length, detached: 0, kept: 0, failed: 0 }

  for (const card of due) {
    const account = card.transaction.vendor.stripeAccountId

    if (!account) {
      summary.failed++
      continue
    }

    const stillNeeded = card.paymentMethodId
      ? await db.cardSecurity.count({
          where: {
            id: { not: card.id },
            paymentMethodId: card.paymentMethodId,
            status: "SECURED",
            OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
          },
        })
      : 0

    try {
      if (stillNeeded > 0) {
        // Another booking still relies on this exact card: only this booking lets go of it.
        await db.cardSecurity.update({ where: { id: card.id }, data: { status: "DETACHED", detachedAt: now } })
        summary.kept++
      } else {
        await detachCard(db, gateway, account, card, now)
        summary.detached++
      }
    } catch (error) {
      summary.failed++
      console.error("Card detach failed", { cardSecurityId: card.id, error: error instanceof Error ? error.message : "Unknown error" })
    }
  }

  return summary
}
