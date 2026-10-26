import { createServer, type IncomingHttpHeaders, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { PARTNER_WEBHOOK_MAX_ATTEMPTS, PARTNER_WEBHOOK_RETRY_DELAYS_MS } from "@/lib/partner-webhooks/backoff"
import { encryptPartnerWebhookSecret } from "@/lib/partner-webhooks/secrets"
import { verifyContrazySignature } from "@/lib/partner-webhooks/signature"

/**
 * Worker integration tests: real HTTP requests to a local `http.createServer`
 * receiver (signing, timeout, response handling all run for real); the
 * database is an in-memory fake of the few Prisma calls the worker makes.
 */

const KEY_MATERIAL = vi.hoisted(() => "k".repeat(48))

type Row = Record<string, unknown>

const db = vi.hoisted(() => ({
  endpoints: [] as Row[],
  deliveries: [] as Row[],
}))

vi.mock("@/lib/env", () => ({
  env: { NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://app.contrazy.test", JWT_ENCRYPTION_SECRET: KEY_MATERIAL },
}))

vi.mock("@/lib/db/prisma", () => {
  const time = (value: unknown) => (value instanceof Date ? value.getTime() : null)

  const isOpen = (row: Row, where: { status?: { in: string[] }; eventType?: { not: string } }) =>
    (!where.status || where.status.in.includes(row.status as string)) &&
    (!where.eventType || row.eventType !== where.eventType.not)

  const byCreatedAt = (a: Row, b: Row) =>
    (time(a.createdAt) ?? 0) - (time(b.createdAt) ?? 0) || String(a.id).localeCompare(String(b.id))

  return {
    prisma: {
      partnerWebhookEndpoint: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => db.endpoints.find((row) => row.id === where.id) ?? null),
      },
      partnerWebhookDelivery: {
        groupBy: vi.fn(async ({ where, take }: { where: Row & { nextAttemptAt: { lte: Date } }; take: number }) => {
          const due = db.deliveries.filter(
            (row) => isOpen(row, where as never) && row.nextAttemptAt instanceof Date && row.nextAttemptAt <= where.nextAttemptAt.lte
          )
          const groups = new Map<string, number>()

          for (const row of due) {
            const at = time(row.nextAttemptAt) as number
            groups.set(row.endpointId as string, Math.min(groups.get(row.endpointId as string) ?? Infinity, at))
          }

          return [...groups.entries()]
            .sort((a, b) => a[1] - b[1])
            .slice(0, take)
            .map(([endpointId, min]) => ({ endpointId, _min: { nextAttemptAt: new Date(min) } }))
        }),
        findFirst: vi.fn(async ({ where, include }: { where: Row; include?: { endpoint: boolean } }) => {
          if (typeof where.id === "string") {
            const vendorId = (where.endpoint as { vendorId: string }).vendorId
            const row = db.deliveries.find((item) => item.id === where.id)
            const endpoint = row && db.endpoints.find((item) => item.id === row.endpointId)

            if (!row || !endpoint || endpoint.vendorId !== vendorId) {
              return null
            }

            return include?.endpoint ? { ...row, endpoint: { ...endpoint } } : { ...row }
          }

          const head = db.deliveries
            .filter((row) => row.endpointId === where.endpointId && isOpen(row, where as never) && row.nextAttemptAt !== null)
            .sort(byCreatedAt)[0]

          return head ? { ...head } : null
        }),
        updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
          const row = db.deliveries.find(
            (item) =>
              item.id === where.id &&
              item.status === where.status &&
              item.attempt === where.attempt &&
              time(item.nextAttemptAt) === time(where.nextAttemptAt)
          )

          if (!row) {
            return { count: 0 }
          }

          Object.assign(row, data)
          return { count: 1 }
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
          const row = db.deliveries.find((item) => item.id === where.id)

          if (!row) {
            throw new Error("Record to update not found.")
          }

          Object.assign(row, data)
          return { ...row }
        }),
      },
    },
  }
})

const { runPartnerWebhookWorker, sendPartnerWebhookDeliveryNow } = await import(
  "@/features/partner-webhooks/server/delivery-worker"
)

type Received = { path: string; headers: IncomingHttpHeaders; body: string }

const SECRET = "whsec_worker_test_secret_0123456789abcdef"
const NOW = new Date("2026-11-02T10:00:00.000Z")

let server: Server
let baseUrl: string
let received: Received[] = []
/** Per path: the status the receiver answers with, or a delay longer than the timeout. */
let responders: Record<string, { status?: number; delayMs?: number; body?: string }> = {}

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on("data", (chunk: Buffer) => chunks.push(chunk))
    request.on("end", () => {
      const path = request.url ?? "/"
      received.push({ path, headers: request.headers, body: Buffer.concat(chunks).toString("utf8") })
      const responder = responders[path] ?? { status: 200 }
      const reply = () => {
        if (response.writableEnded || response.destroyed) {
          return
        }
        response.writeHead(responder.status ?? 200, { "Content-Type": "text/plain" })
        response.end(responder.body ?? "ok")
      }

      if (responder.delayMs) {
        setTimeout(reply, responder.delayMs)
      } else {
        reply()
      }
    })
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function addEndpoint(id: string, path: string, overrides: Row = {}) {
  db.endpoints.push({
    id,
    vendorId: "vendor_1",
    url: `${baseUrl}${path}`,
    encryptedSecret: encryptPartnerWebhookSecret(SECRET, KEY_MATERIAL),
    active: true,
    deletedAt: null,
    ...overrides,
  })
}

function addDelivery(id: string, endpointId: string, overrides: Row = {}) {
  const row = {
    id,
    endpointId,
    eventId: `evt_${id}`,
    eventType: "booking.link_opened",
    payload: { id: `evt_${id}`, type: "booking.link_opened", apiVersion: "2026-11-01", data: { booking: { id: "txn_1" } } },
    attempt: 0,
    status: "PENDING",
    responseStatus: null,
    responseBodySnippet: null,
    lastError: null,
    nextAttemptAt: NOW,
    lastAttemptAt: null,
    deliveredAt: null,
    createdAt: new Date(NOW.getTime() - 60_000),
    ...overrides,
  }
  db.deliveries.push(row)
  return row
}

function delivery(id: string) {
  return db.deliveries.find((row) => row.id === id) as Row
}

const at = (date: Date) => () => date

beforeEach(() => {
  db.endpoints.length = 0
  db.deliveries.length = 0
  received = []
  responders = {}
})

describe("runPartnerWebhookWorker against a local HTTP receiver", () => {
  it("200 -> SUCCEEDED, with a verifiable Contrazy-Signature on the exact raw body", async () => {
    addEndpoint("we_1", "/ok")
    addDelivery("d1", "we_1")
    responders["/ok"] = { status: 200, body: "received" }

    const summary = await runPartnerWebhookWorker({ now: at(NOW) })

    expect(summary).toMatchObject({ endpoints: 1, attempted: 1, succeeded: 1, retried: 0, dead: 0 })
    expect(delivery("d1")).toMatchObject({
      status: "SUCCEEDED",
      attempt: 1,
      responseStatus: 200,
      responseBodySnippet: "received",
      nextAttemptAt: null,
      deliveredAt: NOW,
      lastError: null,
    })

    const [request] = received
    expect(request.headers["content-type"]).toContain("application/json")
    expect(request.headers["contrazy-event-id"]).toBe("evt_d1")
    expect(request.headers["contrazy-event-type"]).toBe("booking.link_opened")
    expect(request.headers["contrazy-api-version"]).toBe("2026-11-01")
    expect(request.headers["contrazy-delivery-attempt"]).toBe("1")
    expect(JSON.parse(request.body)).toEqual(delivery("d1").payload)
    expect(verifyContrazySignature(request.body, request.headers["contrazy-signature"] as string, SECRET)).toBe(true)
    expect(verifyContrazySignature(request.body, request.headers["contrazy-signature"] as string, "whsec_wrong")).toBe(false)
  })

  it("500 -> FAILED with the first retry scheduled 1 minute later", async () => {
    addEndpoint("we_1", "/boom")
    addDelivery("d1", "we_1")
    responders["/boom"] = { status: 500, body: "Internal error" }

    const summary = await runPartnerWebhookWorker({ now: at(NOW) })

    expect(summary).toMatchObject({ attempted: 1, succeeded: 0, retried: 1, dead: 0 })
    expect(delivery("d1")).toMatchObject({
      status: "FAILED",
      attempt: 1,
      responseStatus: 500,
      responseBodySnippet: "Internal error",
      lastError: "Endpoint responded with HTTP 500.",
      deliveredAt: null,
    })
    expect((delivery("d1").nextAttemptAt as Date).getTime()).toBe(NOW.getTime() + 60_000)
  })

  it("timeout -> FAILED with a retry scheduled and no response status", async () => {
    addEndpoint("we_1", "/slow")
    addDelivery("d1", "we_1")
    responders["/slow"] = { status: 200, delayMs: 1_500 }

    const summary = await runPartnerWebhookWorker({ now: at(NOW), timeoutMs: 200 })

    expect(summary).toMatchObject({ attempted: 1, retried: 1 })
    expect(delivery("d1")).toMatchObject({
      status: "FAILED",
      attempt: 1,
      responseStatus: null,
      lastError: "Timed out waiting for the endpoint to respond.",
    })
    expect((delivery("d1").nextAttemptAt as Date).getTime()).toBe(NOW.getTime() + 60_000)
  })

  it("follows the backoff schedule and marks the delivery DEAD after the last attempt", async () => {
    addEndpoint("we_1", "/down")
    addDelivery("d1", "we_1")
    responders["/down"] = { status: 503 }

    let clock = NOW

    for (let attempt = 1; attempt <= PARTNER_WEBHOOK_MAX_ATTEMPTS; attempt++) {
      // Nothing is sent before the retry is due.
      const early = await runPartnerWebhookWorker({ now: at(new Date(clock.getTime() - 1)) })
      expect(early.attempted).toBe(0)

      const summary = await runPartnerWebhookWorker({ now: at(clock) })
      expect(summary.attempted).toBe(1)
      expect(delivery("d1").attempt).toBe(attempt)

      if (attempt < PARTNER_WEBHOOK_MAX_ATTEMPTS) {
        const expectedNext = clock.getTime() + PARTNER_WEBHOOK_RETRY_DELAYS_MS[attempt - 1]
        expect(delivery("d1").status).toBe("FAILED")
        expect((delivery("d1").nextAttemptAt as Date).getTime()).toBe(expectedNext)
        clock = new Date(expectedNext)
      } else {
        expect(summary.dead).toBe(1)
      }
    }

    expect(delivery("d1")).toMatchObject({ status: "DEAD", attempt: 7, nextAttemptAt: null, responseStatus: 503 })
    expect(received).toHaveLength(7)

    // A DEAD delivery is never picked up again.
    const after = await runPartnerWebhookWorker({ now: at(new Date(clock.getTime() + 7 * 86_400_000)) })
    expect(after.attempted).toBe(0)
  })

  it("keeps the response snippet to 1 KB", async () => {
    addEndpoint("we_1", "/verbose")
    addDelivery("d1", "we_1")
    responders["/verbose"] = { status: 400, body: "é".repeat(4_000) }

    await runPartnerWebhookWorker({ now: at(NOW) })

    const snippet = delivery("d1").responseBodySnippet as string
    expect(Buffer.byteLength(snippet, "utf8")).toBeLessThanOrEqual(1_024 + 3)
    expect(snippet.length).toBeLessThanOrEqual(1_024)
  })

  it("sends one endpoint's deliveries in createdAt order", async () => {
    addEndpoint("we_1", "/ok")
    addDelivery("d_new", "we_1", { createdAt: new Date(NOW.getTime() - 1_000) })
    addDelivery("d_old", "we_1", { createdAt: new Date(NOW.getTime() - 5_000) })
    addDelivery("d_mid", "we_1", { createdAt: new Date(NOW.getTime() - 3_000) })

    const summary = await runPartnerWebhookWorker({ now: at(NOW) })

    expect(summary.succeeded).toBe(3)
    expect(received.map((request) => request.headers["contrazy-event-id"])).toEqual(["evt_d_old", "evt_d_mid", "evt_d_new"])
  })

  it("holds newer deliveries behind a failing one (strict per-endpoint order), without blocking other endpoints", async () => {
    addEndpoint("we_1", "/boom")
    addEndpoint("we_2", "/ok")
    addDelivery("d1", "we_1", { createdAt: new Date(NOW.getTime() - 5_000) })
    addDelivery("d2", "we_1", { createdAt: new Date(NOW.getTime() - 1_000) })
    addDelivery("d3", "we_2")
    responders["/boom"] = { status: 500 }

    const summary = await runPartnerWebhookWorker({ now: at(NOW) })

    expect(summary).toMatchObject({ endpoints: 2, attempted: 2, succeeded: 1, retried: 1 })
    expect(delivery("d1").status).toBe("FAILED")
    expect(delivery("d2")).toMatchObject({ status: "PENDING", attempt: 0 })
    expect(delivery("d3").status).toBe("SUCCEEDED")
  })

  it("skips endpoints that were deleted or switched off", async () => {
    addEndpoint("we_1", "/ok", { deletedAt: new Date("2026-11-01T00:00:00.000Z") })
    addDelivery("d1", "we_1")

    const summary = await runPartnerWebhookWorker({ now: at(NOW) })

    expect(summary).toMatchObject({ attempted: 0, skipped: 1 })
    expect(received).toHaveLength(0)
  })

  it("never treats a redirect as success", async () => {
    addEndpoint("we_1", "/moved")
    addDelivery("d1", "we_1")
    responders["/moved"] = { status: 301 }

    await runPartnerWebhookWorker({ now: at(NOW) })

    expect(delivery("d1")).toMatchObject({ status: "FAILED", responseStatus: 301 })
  })
})

describe("sendPartnerWebhookDeliveryNow (manual resend)", () => {
  it("resends a DEAD delivery and marks it SUCCEEDED on 2xx", async () => {
    addEndpoint("we_1", "/ok")
    addDelivery("d1", "we_1", { status: "DEAD", attempt: 7, nextAttemptAt: null })

    const result = await sendPartnerWebhookDeliveryNow("vendor_1", "d1", { now: at(NOW) })

    expect(result).toMatchObject({ kind: "sent", outcome: "succeeded" })
    expect(delivery("d1")).toMatchObject({ status: "SUCCEEDED", attempt: 8, deliveredAt: NOW, nextAttemptAt: null })
    expect(received).toHaveLength(1)
  })

  it("keeps a DEAD delivery DEAD when the resend fails, and keeps a retry schedule untouched", async () => {
    addEndpoint("we_1", "/boom")
    const retryAt = new Date(NOW.getTime() + 30 * 60_000)
    addDelivery("dead", "we_1", { status: "DEAD", attempt: 7, nextAttemptAt: null })
    addDelivery("failing", "we_1", { status: "FAILED", attempt: 2, nextAttemptAt: retryAt })
    responders["/boom"] = { status: 500 }

    await sendPartnerWebhookDeliveryNow("vendor_1", "dead", { now: at(NOW) })
    await sendPartnerWebhookDeliveryNow("vendor_1", "failing", { now: at(NOW) })

    expect(delivery("dead")).toMatchObject({ status: "DEAD", attempt: 8, nextAttemptAt: null })
    expect(delivery("failing")).toMatchObject({ status: "FAILED", attempt: 3, nextAttemptAt: retryAt })
  })

  it("returns not_found for another vendor's delivery and sends nothing", async () => {
    addEndpoint("we_1", "/ok")
    addDelivery("d1", "we_1")

    expect(await sendPartnerWebhookDeliveryNow("vendor_2", "d1")).toEqual({ kind: "not_found" })
    expect(received).toHaveLength(0)
  })

  it("refuses to resend through a deleted endpoint", async () => {
    addEndpoint("we_1", "/ok", { deletedAt: new Date("2026-11-01T00:00:00.000Z") })
    addDelivery("d1", "we_1")

    expect(await sendPartnerWebhookDeliveryNow("vendor_1", "d1")).toEqual({ kind: "endpoint_inactive" })
    expect(received).toHaveLength(0)
  })
})
