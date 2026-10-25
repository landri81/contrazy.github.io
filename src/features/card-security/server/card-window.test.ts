/**
 * C5c: 90-day charge window and card detach (Spec v2.1 §13, T9).
 * Spec §18 #14 (D+90 job: PaymentMethod detached if nothing is open) is covered here;
 * the D+75 alert is on the LOCAZ side (M6).
 */
import type { CardSecurity, PartnerCustomer } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { CARD_CHARGE_WINDOW_DAYS, chargeWindowEnd, detachCustomerCards, detachExpiredCards, findCardBlockers, markVehicleReturned } from "./card-window"
import { createInMemoryStripeGateway } from "@/lib/integrations/stripe-gateway"

const ACCOUNT = "acct_locaz_test"
const DAY = 86_400_000
const NOW = new Date("2027-03-01T10:00:00Z")

type Card = CardSecurity & { dispute: string | null; externalRef: string; charges?: string[] }

function card(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    transactionId: `tx-${id}`,
    partnerCustomerId: "pc1",
    stripeCustomerId: "cus_1",
    status: "SECURED",
    setupIntentId: null,
    paymentIntentId: null,
    paymentMethodId: `pm_${id}`,
    cardBrand: "visa",
    cardLast4: "4242",
    cardExpMonth: 12,
    cardExpYear: 2030,
    securedAt: new Date("2026-11-01T10:00:00Z"),
    windowEndsAt: null,
    detachedAt: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
    dispute: null,
    externalRef: `LZ-${id}`,
    ...overrides,
  }
}

const openDispute = (c: Card) => c.dispute === "OPEN" || c.dispute === "UNDER_REVIEW"
const openCharge = (c: Card) => (c.charges ?? []).some((s) => ["PENDING", "PROCESSING", "FAILED", "REQUIRES_ACTION"].includes(s))
const windowOpen = (c: Card, now: Date) => c.windowEndsAt === null || c.windowEndsAt > now

/** The card-window queries, applied in plain code on a list of cards. */
function createDb(cards: Card[]) {
  return {
    cards,
    cardSecurity: {
      async findUnique({ where }: { where: { transactionId: string } }) {
        return cards.find((c) => c.transactionId === where.transactionId) ?? null
      },
      async update({ where, data }: { where: { id: string }; data: Partial<Card> }) {
        return Object.assign(cards.find((c) => c.id === where.id)!, data)
      },
      async findMany({ where, take }: { where: Record<string, unknown>; take?: number }) {
        const now = ((where.windowEndsAt as { lte?: Date })?.lte ?? (where.OR as { windowEndsAt?: { gt: Date } }[] | undefined)?.find((o) => o.windowEndsAt?.gt)?.windowEndsAt?.gt) as Date | undefined
        const rows = cards.filter((c) => {
          if (where.partnerCustomerId && c.partnerCustomerId !== where.partnerCustomerId) return false
          if (c.status !== where.status) return false
          if (where.OR) return windowOpen(c, now!) || openDispute(c) || openCharge(c)
          if (where.windowEndsAt) return c.windowEndsAt !== null && c.windowEndsAt <= now! && !openDispute(c) && !openCharge(c)
          return true
        })
        return rows.slice(0, take ?? rows.length).map((c) => ({
          ...c,
          transaction: {
            externalRef: c.externalRef,
            dispute: c.dispute ? { status: c.dispute } : null,
            postCharges: openCharge(c) ? [{ id: "charge" }] : [],
            vendor: { stripeAccountId: ACCOUNT },
          },
        }))
      },
      async count({ where }: { where: { id: { not: string }; paymentMethodId: string; OR: { windowEndsAt?: { gt: Date } }[] } }) {
        const now = where.OR.find((o) => o.windowEndsAt?.gt)!.windowEndsAt!.gt
        return cards.filter((c) => c.id !== where.id.not && c.paymentMethodId === where.paymentMethodId && c.status === "SECURED" && windowOpen(c, now)).length
      },
    },
  }
}

async function gatewayWithSavedCards(...pms: string[]) {
  const gateway = createInMemoryStripeGateway()
  // Save each test card on the customer, as the card-security step does.
  for (const pm of pms) {
    const si = await gateway.payments.createSetupIntent({ customer: "cus_1", usage: "off_session" }, { account: ACCOUNT })
    gateway.paymentsFake.confirmOnSession("setup_intent", si.id, ACCOUNT, pm as never)
  }
  return gateway
}

const customer = { id: "pc1", vendorId: "v1", stripeCustomerId: "cus_1" } as PartnerCustomer

describe("90-day charge window", () => {
  it("ends 90 days after the vehicle is returned", async () => {
    const db = createDb([card("a")])
    const returnedAt = new Date("2026-11-05T17:30:00Z")
    const updated = await markVehicleReturned(db as never, { transactionId: "tx-a", returnedAt })

    expect(CARD_CHARGE_WINDOW_DAYS).toBe(90)
    expect(updated.windowEndsAt).toEqual(new Date(returnedAt.getTime() + 90 * DAY))
    expect(chargeWindowEnd(returnedAt).toISOString()).toBe("2027-02-03T17:30:00.000Z")
  })

  it("has no window without a saved card, nor once the card is detached", async () => {
    const db = createDb([card("p", { status: "PENDING" }), card("d", { status: "DETACHED" })])

    await expect(markVehicleReturned(db as never, { transactionId: "tx-none", returnedAt: NOW })).rejects.toMatchObject({ code: "card_not_secured" })
    await expect(markVehicleReturned(db as never, { transactionId: "tx-p", returnedAt: NOW })).rejects.toMatchObject({ code: "card_not_secured" })
    await expect(markVehicleReturned(db as never, { transactionId: "tx-d", returnedAt: NOW })).rejects.toMatchObject({ code: "card_detached" })
  })
})

describe("detaching a customer's card (T9)", () => {
  it("is refused while a booking of the customer is not returned, within its window or disputed", async () => {
    const db = createDb([
      card("returned-long-ago", { windowEndsAt: new Date(NOW.getTime() - DAY) }),
      card("not-returned"),
      card("in-window", { windowEndsAt: new Date(NOW.getTime() + 10 * DAY) }),
      card("disputed", { windowEndsAt: new Date(NOW.getTime() - DAY), dispute: "OPEN" }),
      card("unpaid", { windowEndsAt: new Date(NOW.getTime() - DAY), charges: ["SUCCEEDED", "FAILED"] }),
      card("settled", { windowEndsAt: new Date(NOW.getTime() - DAY), charges: ["SUCCEEDED", "REFUNDED"] }),
    ])

    const blockers = await findCardBlockers(db as never, "pc1", NOW)
    expect(blockers.map((b) => [b.bookingId, b.reason])).toEqual([
      ["tx-not-returned", "not_returned"],
      ["tx-in-window", "charge_window_open"],
      ["tx-disputed", "open_dispute"],
      ["tx-unpaid", "open_charge"],
    ])

    const gateway = await gatewayWithSavedCards("pm_card_visa")
    const error = await detachCustomerCards(db as never, gateway, { partnerCustomer: customer, account: ACCOUNT, now: NOW }).catch((e) => e)
    expect(error).toMatchObject({ code: "card_in_use" })
    expect(error.details.blockingBookings).toHaveLength(4)
    expect(gateway.paymentsFake.calls.some((c) => c.method === "detachPaymentMethod")).toBe(false)
  })

  it("detaches every saved card once no booking needs it any more (the Stripe customer stays)", async () => {
    const db = createDb([
      card("a", { paymentMethodId: "pm_card_visa", windowEndsAt: new Date(NOW.getTime() - DAY) }),
      card("b", { paymentMethodId: "pm_card_threeDSecure2Required", windowEndsAt: new Date(NOW.getTime() - 2 * DAY) }),
    ])
    const gateway = await gatewayWithSavedCards("pm_card_visa", "pm_card_threeDSecure2Required")

    const result = await detachCustomerCards(db as never, gateway, { partnerCustomer: customer, account: ACCOUNT, now: NOW })

    expect(result).toEqual({ detached: 2 })
    expect(db.cards.map((c) => c.status)).toEqual(["DETACHED", "DETACHED"])
    expect(gateway.paymentsFake.paymentMethod(ACCOUNT, "pm_card_visa")?.customer).toBeNull()
    expect(gateway.paymentsFake.paymentMethod(ACCOUNT, "pm_card_threeDSecure2Required")?.customer).toBeNull()
  })
})

describe("daily detach job after the window (Spec §18 #14)", () => {
  it("detaches cards whose window ended, skips disputed ones and leaves open windows alone", async () => {
    const db = createDb([
      card("ended", { paymentMethodId: "pm_card_visa", windowEndsAt: new Date(NOW.getTime() - DAY) }),
      card("disputed", { paymentMethodId: "pm_card_chargeCustomerFail", windowEndsAt: new Date(NOW.getTime() - DAY), dispute: "UNDER_REVIEW" }),
      card("open", { paymentMethodId: "pm_card_threeDSecure2Required", windowEndsAt: new Date(NOW.getTime() + DAY) }),
      card("unpaid", { paymentMethodId: "pm_card_authenticationRequired", windowEndsAt: new Date(NOW.getTime() - DAY), charges: ["REQUIRES_ACTION"] }),
    ])
    const gateway = await gatewayWithSavedCards("pm_card_visa", "pm_card_chargeCustomerFail", "pm_card_threeDSecure2Required", "pm_card_authenticationRequired")

    const summary = await detachExpiredCards(db as never, gateway, NOW)

    expect(summary).toEqual({ due: 1, detached: 1, kept: 0, failed: 0 })
    expect(db.cards.map((c) => [c.id, c.status])).toEqual([["ended", "DETACHED"], ["disputed", "SECURED"], ["open", "SECURED"], ["unpaid", "SECURED"]])
    expect(gateway.paymentsFake.paymentMethod(ACCOUNT, "pm_card_visa")?.customer).toBeNull()
    expect(gateway.paymentsFake.paymentMethod(ACCOUNT, "pm_card_chargeCustomerFail")?.customer).toBe("cus_1")
  })

  it("keeps the PaymentMethod at Stripe when another booking still uses the same card", async () => {
    const db = createDb([
      card("old", { paymentMethodId: "pm_card_visa", windowEndsAt: new Date(NOW.getTime() - DAY) }),
      card("new", { paymentMethodId: "pm_card_visa", windowEndsAt: null }),
    ])
    const gateway = await gatewayWithSavedCards("pm_card_visa")

    const summary = await detachExpiredCards(db as never, gateway, NOW)

    expect(summary).toEqual({ due: 1, detached: 0, kept: 1, failed: 0 })
    expect(db.cards.map((c) => c.status)).toEqual(["DETACHED", "SECURED"])
    expect(gateway.paymentsFake.paymentMethod(ACCOUNT, "pm_card_visa")?.customer).toBe("cus_1")
  })

  it("treats a card already detached at Stripe as done", async () => {
    const db = createDb([card("gone", { paymentMethodId: "pm_card_visa", windowEndsAt: new Date(NOW.getTime() - DAY) })])
    const gateway = await gatewayWithSavedCards("pm_card_visa")
    await gateway.payments.detachPaymentMethod("pm_card_visa", { account: ACCOUNT })

    expect(await detachExpiredCards(db as never, gateway, NOW)).toEqual({ due: 1, detached: 1, kept: 0, failed: 0 })
    expect(db.cards[0].status).toBe("DETACHED")
  })
})
