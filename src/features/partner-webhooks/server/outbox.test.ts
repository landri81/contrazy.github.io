import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"

import { buildPartnerBookingRecord } from "@/features/partner-webhooks/__fixtures__/partner-booking"
import {
  recordCardSecuredEvent,
  recordChargeOutcomeEvent,
  recordRefundSucceededEvent,
} from "@/features/partner-webhooks/server/charge-events"
import { derivePartnerWebhookEventId } from "@/features/partner-webhooks/server/outbox"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"

vi.mock("@/lib/env", () => ({
  env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://app.contrazy.test", JWT_ENCRYPTION_SECRET: "k".repeat(48) },
}))

/**
 * Integration tests for the outbox: `recordTransactionEvent` against an
 * in-memory database that implements Prisma's interactive transaction
 * semantics (every write inside `$transaction` is rolled back when the
 * callback throws). Proves the delivery row is written by the same
 * transaction client as the timeline event, and never for dashboard rows.
 */

type Row = Record<string, unknown>

type State = {
  transactions: Row[]
  events: Row[]
  endpoints: Row[]
  deliveries: Row[]
}

type Write = { client: "root" | "tx"; model: string; op: string }

function createFakeDb(initial: State) {
  let state: State = structuredClone(initial)
  const writes: Write[] = []
  let sequence = 0
  let failDeliveryInsert = false

  function client(kind: "root" | "tx") {
    const db: Record<string, unknown> = {
      transaction: {
        findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: Row }) => {
          const row = state.transactions.find((item) => item.id === where.id)

          if (!row) {
            return null
          }

          if (select) {
            return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]))
          }

          // `include: partnerBookingInclude`: the full booking with its relations.
          return buildPartnerBookingRecord({ id: row.id as string, vendorId: row.vendorId as string } as never)
        }),
      },
      transactionEvent: {
        create: vi.fn(async ({ data }: { data: Row }) => {
          writes.push({ client: kind, model: "transactionEvent", op: "create" })
          const row = { id: `tev_${++sequence}`, ...data }
          state.events.push(row)
          return row
        }),
        upsert: vi.fn(async ({ where, update, create }: { where: { dedupeKey: string }; update: Row; create: Row }) => {
          writes.push({ client: kind, model: "transactionEvent", op: "upsert" })
          const existing = state.events.find((item) => item.dedupeKey === where.dedupeKey)

          if (existing) {
            Object.assign(existing, update)
            return existing
          }

          const row = { id: `tev_${++sequence}`, ...create }
          state.events.push(row)
          return row
        }),
      },
      partnerWebhookEndpoint: {
        findMany: vi.fn(async ({ where }: { where: { vendorId: string; active: boolean; deletedAt: null; eventTypes: { has: string } } }) =>
          state.endpoints
            .filter(
              (item) =>
                item.vendorId === where.vendorId &&
                item.active === where.active &&
                item.deletedAt === null &&
                (item.eventTypes as string[]).includes(where.eventTypes.has)
            )
            .map((item) => ({ id: item.id }))
        ),
      },
      partnerWebhookDelivery: {
        createMany: vi.fn(async ({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) => {
          writes.push({ client: kind, model: "partnerWebhookDelivery", op: "createMany" })

          if (failDeliveryInsert) {
            throw new Error("insert failed")
          }

          let count = 0

          for (const row of data) {
            if (state.deliveries.some((item) => item.eventId === row.eventId)) {
              if (!skipDuplicates) {
                throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
              }
              continue
            }

            state.deliveries.push({ id: `whd_${++sequence}`, attempt: 0, ...row })
            count++
          }

          return { count }
        }),
      },
    }

    return db
  }

  const tx = client("tx")
  const root = client("root")
  root.$transaction = vi.fn(async (callback: (txClient: unknown) => Promise<unknown>) => {
    const snapshot = structuredClone(state)

    try {
      return await callback(tx)
    } catch (error) {
      state = snapshot
      throw error
    }
  })

  return {
    root: root as unknown as PrismaClient,
    tx: tx as unknown as PrismaClient,
    writes,
    get state() {
      return state
    },
    failDeliveries(value: boolean) {
      failDeliveryInsert = value
    },
  }
}

const PARTNER_TXN = { id: "txn_partner_1", vendorId: "vendor_1", source: "PARTNER_API" }
const DASHBOARD_TXN = { id: "txn_dashboard_1", vendorId: "vendor_1", source: "DASHBOARD" }

function endpoint(overrides: Row = {}): Row {
  return {
    id: "we_1",
    vendorId: "vendor_1",
    active: true,
    deletedAt: null,
    eventTypes: ["booking.link_opened", "booking.cancelled", "charge.failed", "charge.succeeded", "refund.succeeded", "booking.card_secured"],
    ...overrides,
  }
}

let fake: ReturnType<typeof createFakeDb>

beforeEach(() => {
  fake = createFakeDb({
    transactions: [PARTNER_TXN, DASHBOARD_TXN],
    events: [],
    endpoints: [
      endpoint(),
      endpoint({ id: "we_2", eventTypes: ["booking.link_opened"] }),
      endpoint({ id: "we_other_vendor", vendorId: "vendor_2" }),
      endpoint({ id: "we_inactive", active: false }),
      endpoint({ id: "we_deleted", deletedAt: new Date("2026-10-01T00:00:00.000Z") }),
      endpoint({ id: "we_unsubscribed", eventTypes: ["booking.completed"] }),
    ],
    deliveries: [],
  })
})

describe("recordTransactionEvent -> partner webhook outbox", () => {
  it("writes the timeline event and one PENDING delivery per subscribed endpoint in the same transaction", async () => {
    const event = await recordTransactionEvent(fake.root, {
      transactionId: PARTNER_TXN.id,
      type: "LINK_OPENED",
      title: "Link opened",
    })

    expect(fake.root.$transaction).toHaveBeenCalledTimes(1)
    expect(fake.writes).toEqual([
      { client: "tx", model: "transactionEvent", op: "create" },
      { client: "tx", model: "partnerWebhookDelivery", op: "createMany" },
    ])
    expect(fake.state.events).toHaveLength(1)
    expect(fake.state.deliveries.map((row) => row.endpointId).sort()).toEqual(["we_1", "we_2"])

    for (const delivery of fake.state.deliveries) {
      expect(delivery).toMatchObject({
        transactionId: PARTNER_TXN.id,
        transactionEventId: (event as Row).id,
        eventType: "booking.link_opened",
        status: "PENDING",
        nextAttemptAt: expect.any(Date),
      })
      expect(delivery.eventId).toBe(
        derivePartnerWebhookEventId({
          endpointId: delivery.endpointId as string,
          transactionId: PARTNER_TXN.id,
          transactionEventId: (event as Row).id as string,
          type: "booking.link_opened",
        })
      )
      expect(delivery.payload).toMatchObject({
        id: delivery.eventId,
        type: "booking.link_opened",
        apiVersion: "2026-11-01",
        data: { booking: { id: PARTNER_TXN.id, externalRef: "LOCAZ-BK-42" } },
      })
    }
  })

  it("rolls the timeline event back when the delivery insert fails (no step without its webhook)", async () => {
    fake.failDeliveries(true)

    await expect(
      recordTransactionEvent(fake.root, { transactionId: PARTNER_TXN.id, type: "LINK_OPENED", title: "Link opened" })
    ).rejects.toThrow("insert failed")

    expect(fake.state.events).toHaveLength(0)
    expect(fake.state.deliveries).toHaveLength(0)
  })

  it("joins the caller's transaction when given a transaction client", async () => {
    await recordTransactionEvent(fake.tx, { transactionId: PARTNER_TXN.id, type: "LINK_OPENED", title: "Link opened" })

    expect(fake.root.$transaction).not.toHaveBeenCalled()
    expect(fake.writes.every((write) => write.client === "tx")).toBe(true)
    expect(fake.state.deliveries).toHaveLength(2)
  })

  it("never emits for dashboard transactions and keeps their plain write path", async () => {
    await recordTransactionEvent(fake.root, { transactionId: DASHBOARD_TXN.id, type: "LINK_OPENED", title: "Link opened" })

    expect(fake.root.$transaction).not.toHaveBeenCalled()
    expect(fake.writes).toEqual([{ client: "root", model: "transactionEvent", op: "create" }])
    expect(fake.state.events).toHaveLength(1)
    expect(fake.state.deliveries).toHaveLength(0)
  })

  it("does not look up the booking for internal events", async () => {
    const findUnique = (fake.root as unknown as { transaction: { findUnique: ReturnType<typeof vi.fn> } }).transaction.findUnique

    await recordTransactionEvent(fake.root, { transactionId: PARTNER_TXN.id, type: "EMAIL_SENT", title: "Email sent" })

    expect(findUnique).not.toHaveBeenCalled()
    expect(fake.state.deliveries).toHaveLength(0)
  })

  it("queues nothing when no active endpoint of the vendor subscribes to the event", async () => {
    await recordTransactionEvent(fake.root, { transactionId: PARTNER_TXN.id, type: "KYC_VERIFIED", title: "Identity verified" })

    expect(fake.state.events).toHaveLength(1)
    expect(fake.state.deliveries).toHaveLength(0)
  })

  it("queues one delivery when an event is written again through its dedupe key", async () => {
    const input = { transactionId: PARTNER_TXN.id, type: "LINK_OPENED" as const, title: "Link opened", dedupeKey: "link-opened:txn_partner_1" }

    await recordTransactionEvent(fake.root, input)
    await recordTransactionEvent(fake.root, input)

    expect(fake.state.events).toHaveLength(1)
    expect(fake.state.deliveries).toHaveLength(2)
  })

  it("sends booking.cancelled once even when a vendor cancel records two timeline events", async () => {
    await recordTransactionEvent(fake.root, { transactionId: PARTNER_TXN.id, type: "TRANSACTION_CANCELLED", title: "Cancelled" })
    await recordTransactionEvent(fake.root, { transactionId: PARTNER_TXN.id, type: "LINK_CANCELLED", title: "Link cancelled" })

    expect(fake.state.events).toHaveLength(2)
    expect(fake.state.deliveries.filter((row) => row.eventType === "booking.cancelled")).toHaveLength(1)
  })
})

describe("card, charge and refund emitters", () => {
  const charge = {
    id: "chg_1",
    externalRef: "LOCAZ-CHG-7",
    type: "FUEL",
    amount: 4_500,
    currency: "EUR",
    attempt: 1,
    declineCode: "insufficient_funds",
    nextRetryAt: new Date("2026-11-10T10:00:00.000Z"),
  }

  it("records CHARGE_FAILED and queues charge.failed with the retry facts only", async () => {
    await recordChargeOutcomeEvent(fake.root, { transactionId: PARTNER_TXN.id, outcome: "failed", charge })

    expect(fake.state.events[0]).toMatchObject({ type: "CHARGE_FAILED", dedupeKey: "charge:chg_1:attempt:1:failed" })
    expect(fake.state.deliveries).toHaveLength(1)
    expect((fake.state.deliveries[0].payload as { data: Row }).data.charge).toEqual({
      chargeId: "chg_1",
      externalRef: "LOCAZ-CHG-7",
      type: "FUEL",
      amount: 4_500,
      currency: "EUR",
      status: "failed",
      attempt: 1,
      declineCode: "insufficient_funds",
      nextRetryAt: "2026-11-10T10:00:00.000Z",
      paymentLinkUrl: null,
      cardUpdateUrl: null,
    })
  })

  it("records CHARGE_SUCCEEDED without decline or link facts", async () => {
    await recordChargeOutcomeEvent(fake.root, { transactionId: PARTNER_TXN.id, outcome: "succeeded", charge: { ...charge, attempt: 2 } })

    expect(fake.state.events[0]).toMatchObject({ type: "CHARGE_SUCCEEDED" })
    expect((fake.state.deliveries[0].payload as { type: string; data: Row }).data.charge).toMatchObject({
      status: "succeeded",
      attempt: 2,
      declineCode: null,
      nextRetryAt: null,
    })
  })

  it("records REFUND_SUCCEEDED once per refund and queues refund.succeeded", async () => {
    const refund = { id: "ref_1", chargeId: "chg_1", amount: 1_000, currency: "EUR", reason: "Goodwill" }

    await recordRefundSucceededEvent(fake.root, { transactionId: PARTNER_TXN.id, refund })
    await recordRefundSucceededEvent(fake.root, { transactionId: PARTNER_TXN.id, refund })

    expect(fake.state.events).toHaveLength(1)
    expect(fake.state.deliveries).toHaveLength(1)
    expect(fake.state.deliveries[0]).toMatchObject({ eventType: "refund.succeeded" })
  })

  it("records CARD_SECURED and queues booking.card_secured without card details", async () => {
    await recordCardSecuredEvent(fake.root, { transactionId: PARTNER_TXN.id })

    expect(fake.state.events[0]).toMatchObject({ type: "CARD_SECURED", metadata: { usage: "off_session" } })
    expect((fake.state.deliveries[0].payload as { data: Row }).data.card).toMatchObject({ usage: "off_session" })
  })

  it("emits nothing for a dashboard transaction", async () => {
    await recordChargeOutcomeEvent(fake.root, { transactionId: DASHBOARD_TXN.id, outcome: "succeeded", charge })

    expect(fake.state.events).toHaveLength(1)
    expect(fake.state.deliveries).toHaveLength(0)
  })
})
