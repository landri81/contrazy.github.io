import type Stripe from "stripe"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * C8: Stripe chargebacks become a CHARGEBACK dispute with its reason, amount and evidence deadline, and a
 * DISPUTE_OPENED / DISPUTE_UPDATED / DISPUTE_CLOSED timeline event (partners hear about it through the
 * outbox). Prisma is an in-memory fake.
 */

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  disputes: new Map<string, Row>(),
  events: [] as Row[],
  payments: new Map<string, Row>(),
  postCharges: new Map<string, Row>(),
}))

vi.mock("@/lib/db/prisma", () => {
  const tx = {
    dispute: {
      upsert: async ({ where, update, create }: { where: { transactionId: string }; update: Row; create: Row }) => {
        const existing = state.disputes.get(where.transactionId)
        const row = existing ? { ...existing, ...update } : { ...create }
        state.disputes.set(where.transactionId, row)
        return row
      },
    },
  }
  return {
    prisma: {
      payment: { findFirst: async ({ where }: { where: { stripeIntentId: string } }) => state.payments.get(where.stripeIntentId) ?? null },
      postCharge: { findUnique: async ({ where }: { where: { paymentIntentId: string } }) => state.postCharges.get(where.paymentIntentId) ?? null },
      $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
    },
  }
})

vi.mock("@/features/transactions/server/transaction-events", () => ({
  recordTransactionEvent: async (_db: unknown, event: Row) => {
    state.events.push(event)
  },
}))

const { handleDisputeCreated, handleDisputeUpdated } = await import("./dispute")

function stripeDispute(overrides: Partial<Stripe.Dispute> = {}) {
  return {
    id: "dp_test_1",
    object: "dispute",
    payment_intent: "pi_rental_1",
    status: "needs_response",
    reason: "fraudulent",
    amount: 15_000,
    currency: "eur",
    created: Date.parse("2026-11-20T10:00:00Z") / 1000,
    evidence_details: { due_by: Date.parse("2026-12-01T23:59:59Z") / 1000 },
    ...overrides,
  } as unknown as Stripe.Dispute
}

beforeEach(() => {
  state.disputes.clear()
  state.events.length = 0
  state.payments.clear()
  state.postCharges.clear()
  state.payments.set("pi_rental_1", { transactionId: "txn_1", transaction: { vendor: { id: "ven_1" } } })
})

describe("Stripe dispute handlers (C8)", () => {
  it("opens a chargeback with its reason, amount and evidence deadline, and a DISPUTE_OPENED event", async () => {
    expect(await handleDisputeCreated(stripeDispute(), "evt_1", "charge.dispute.created")).toEqual({ vendorId: "ven_1", transactionId: "txn_1" })

    expect(state.disputes.get("txn_1")).toMatchObject({
      status: "OPEN",
      kind: "CHARGEBACK",
      reason: "fraudulent",
      amount: 15_000,
      currency: "eur",
      evidenceDueBy: new Date("2026-12-01T23:59:59Z"),
      stripeDisputeId: "dp_test_1",
      openedAt: new Date("2026-11-20T10:00:00Z"),
    })
    expect(state.events).toEqual([expect.objectContaining({ transactionId: "txn_1", type: "DISPUTE_OPENED", dedupeKey: "webhook:evt_1" })])
  })

  it("records an update as DISPUTE_UPDATED and a won or lost dispute as DISPUTE_CLOSED", async () => {
    await handleDisputeCreated(stripeDispute(), "evt_1", "charge.dispute.created")
    await handleDisputeUpdated(stripeDispute({ status: "under_review" }), "evt_2", "charge.dispute.updated")
    expect(state.disputes.get("txn_1")).toMatchObject({ status: "UNDER_REVIEW", resolvedAt: null })

    await handleDisputeUpdated(stripeDispute({ status: "lost" }), "evt_3", "charge.dispute.closed")
    expect(state.disputes.get("txn_1")).toMatchObject({ status: "LOST", kind: "CHARGEBACK" })
    expect(state.disputes.get("txn_1")?.resolvedAt).toBeInstanceOf(Date)

    expect(state.events.map((event) => event.type)).toEqual(["DISPUTE_OPENED", "DISPUTE_UPDATED", "DISPUTE_CLOSED"])
  })

  it("finds a chargeback on a post-rental charge, and ignores one it cannot match", async () => {
    state.postCharges.set("pi_charge_9", { transactionId: "txn_9", vendorId: "ven_1" })
    expect(await handleDisputeCreated(stripeDispute({ payment_intent: "pi_charge_9" }), "evt_4", "charge.dispute.created")).toEqual({ vendorId: "ven_1", transactionId: "txn_9" })

    expect(await handleDisputeCreated(stripeDispute({ payment_intent: "pi_unknown" }), "evt_5", "charge.dispute.created")).toEqual({ vendorId: null, transactionId: null })
    expect(state.events.map((event) => event.transactionId)).toEqual(["txn_9"])
  })
})
