import { beforeEach, describe, expect, it, vi } from "vitest"

import { generatePartnerApiKey } from "@/lib/partner-api/keys"
import { PARTNER_API_RATE_LIMIT_PER_MINUTE, partnerApiRateLimiter } from "@/lib/partner-api/rate-limit"

type StoredKey = {
  id: string
  vendorId: string
  name: string
  prefix: string
  hashedKey: string
  scopes: string[]
  mode: "TEST" | "LIVE"
  lastUsedAt: Date | null
  createdById: string | null
  revokedAt: Date | null
  createdAt: Date
}

const db = vi.hoisted(() => ({
  keys: [] as Array<Record<string, unknown>>,
  auditRows: [] as Array<{ data: Record<string, unknown> }>,
}))

vi.mock("@/lib/db/prisma", () => {
  const vendor = { id: "vendor_1", businessName: "Test Rentals" }

  return {
    prisma: {
      partnerApiKey: {
        findUnique: vi.fn(async ({ where }: { where: { hashedKey: string } }) => {
          const key = db.keys.find((item) => item.hashedKey === where.hashedKey)
          return key ? { ...key, vendor } : null
        }),
        updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: { lastUsedAt: Date } }) => {
          const key = db.keys.find((item) => item.id === where.id)

          if (key) {
            key.lastUsedAt = data.lastUsedAt
          }

          return { count: key ? 1 : 0 }
        }),
      },
      auditLog: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          db.auditRows.push(args)
          return { id: `audit_${db.auditRows.length}`, ...args.data }
        }),
      },
    },
  }
})

const { prisma } = await import("@/lib/db/prisma")
const { GET } = await import("@/app/api/partner/v1/ping/route")

function storeKey(overrides: Partial<StoredKey> & { scopes?: string[] } = {}) {
  const generated = generatePartnerApiKey("TEST")
  const record: StoredKey = {
    id: `key_${db.keys.length + 1}`,
    vendorId: "vendor_1",
    name: "LOCAZ test",
    prefix: generated.prefix,
    hashedKey: generated.hashedKey,
    scopes: ["bookings:read"],
    mode: "TEST",
    lastUsedAt: null,
    createdById: "user_1",
    revokedAt: null,
    createdAt: new Date("2026-10-24T08:00:00.000Z"),
    ...overrides,
  }
  db.keys.push(record)
  return { key: generated.key, record }
}

function ping(authorization?: string) {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })

  if (authorization) {
    headers.set("authorization", authorization)
  }

  return GET(new Request("http://localhost/api/partner/v1/ping", { headers }), { params: Promise.resolve({}) })
}

function collectConsoleOutput() {
  const calls: unknown[][] = []

  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      calls.push(args)
    })
  }

  return () => JSON.stringify(calls, (_key, value) => (value instanceof Error ? value.message : value))
}

beforeEach(() => {
  db.keys.length = 0
  db.auditRows.length = 0
  partnerApiRateLimiter.reset()
  vi.mocked(prisma.partnerApiKey.updateMany).mockClear()
})

describe("GET /api/partner/v1/ping", () => {
  it("returns vendor and key details for a valid key", async () => {
    const readLogs = collectConsoleOutput()
    const { key, record } = storeKey({ scopes: ["bookings:read", "bookings:write"] })

    const response = await ping(`Bearer ${key}`)

    expect(response.status).toBe(200)
    expect(response.headers.get("request_id")).toMatch(/^req_/)
    expect(await response.json()).toEqual({
      vendorId: "vendor_1",
      keyPrefix: record.prefix,
      mode: "TEST",
      scopes: ["bookings:read", "bookings:write"],
      platformPartner: null,
    })
    expect(db.auditRows).toHaveLength(0)
    expect(readLogs()).not.toContain(key)
  })

  it("updates lastUsedAt at most once per minute", async () => {
    const { key, record } = storeKey()

    await ping(`Bearer ${key}`)
    await ping(`Bearer ${key}`)

    expect(prisma.partnerApiKey.updateMany).toHaveBeenCalledTimes(1)
    expect(record.lastUsedAt).toBeInstanceOf(Date)

    record.lastUsedAt = new Date(Date.now() - 61_000)
    await ping(`Bearer ${key}`)
    expect(prisma.partnerApiKey.updateMany).toHaveBeenCalledTimes(2)
  })

  it("returns 401 invalid_api_key and audits a missing key", async () => {
    const response = await ping()

    expect(response.status).toBe(401)
    expect(response.headers.get("request_id")).toMatch(/^req_/)
    expect(await response.json()).toEqual({
      error: { code: "invalid_api_key", message: "The API key is missing, invalid or revoked." },
    })
    expect(db.auditRows).toHaveLength(1)
    expect(db.auditRows[0]?.data).toMatchObject({
      action: "partner_api.refused",
      actorType: "SYSTEM",
      metadata: { reason: "missing_key", keyPrefix: null, ip: "203.0.113.7" },
    })
  })

  it("refuses non-Bearer schemes", async () => {
    const { key } = storeKey()
    const readLogs = collectConsoleOutput()

    const response = await ping(`Basic ${key}`)

    expect(response.status).toBe(401)
    expect(db.auditRows[0]?.data.metadata).toMatchObject({ reason: "invalid_scheme" })
    expect(JSON.stringify(db.auditRows)).not.toContain(key)
    expect(readLogs()).not.toContain(key)
  })

  it("returns 401 for an unknown key without echoing it", async () => {
    const { key } = generatePartnerApiKey("TEST")
    const readLogs = collectConsoleOutput()

    const response = await ping(`Bearer ${key}`)

    expect(response.status).toBe(401)
    expect(db.auditRows[0]?.data.metadata).toMatchObject({ reason: "unknown_key", keyPrefix: key.slice(0, 16) })
    expect(JSON.stringify(db.auditRows)).not.toContain(key)
    expect(readLogs()).not.toContain(key)
  })

  it("returns 401 for a revoked key and audits it", async () => {
    const readLogs = collectConsoleOutput()
    const { key, record } = storeKey({ revokedAt: new Date("2026-10-24T09:00:00.000Z") })

    const response = await ping(`Bearer ${key}`)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe("invalid_api_key")
    expect(db.auditRows).toHaveLength(1)
    expect(db.auditRows[0]?.data).toMatchObject({
      action: "partner_api.refused",
      entityType: "PartnerApiKey",
      entityId: record.id,
      metadata: { reason: "revoked_key", keyPrefix: record.prefix, ip: "203.0.113.7", vendorId: "vendor_1" },
    })
    expect(JSON.stringify(db.auditRows)).not.toContain(key)
    expect(JSON.stringify(body)).not.toContain(key)
    expect(readLogs()).not.toContain(key)
    expect(prisma.partnerApiKey.updateMany).not.toHaveBeenCalled()
  })

  it("returns 403 insufficient_scope when the key lacks bookings:read", async () => {
    const readLogs = collectConsoleOutput()
    const { key, record } = storeKey({ scopes: ["charges:write"] })

    const response = await ping(`Bearer ${key}`)

    expect(response.status).toBe(403)
    expect(response.headers.get("request_id")).toMatch(/^req_/)
    expect(await response.json()).toEqual({
      error: {
        code: "insufficient_scope",
        message: 'This API key does not have the "bookings:read" scope.',
        details: { requiredScope: "bookings:read" },
      },
    })
    expect(db.auditRows[0]?.data).toMatchObject({
      action: "partner_api.refused",
      metadata: { reason: "insufficient_scope", keyPrefix: record.prefix, ip: "203.0.113.7" },
    })
    expect(JSON.stringify(db.auditRows)).not.toContain(key)
    expect(readLogs()).not.toContain(key)
  })

  it("returns 429 with Retry-After once the per-key limit is reached", async () => {
    const readLogs = collectConsoleOutput()
    const { key, record } = storeKey()

    for (let index = 0; index < PARTNER_API_RATE_LIMIT_PER_MINUTE; index += 1) {
      const response = await ping(`Bearer ${key}`)
      expect(response.status).toBe(200)
    }

    const limited = await ping(`Bearer ${key}`)
    const body = await limited.json()

    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1)
    expect(Number(limited.headers.get("Retry-After"))).toBeLessThanOrEqual(60)
    expect(limited.headers.get("request_id")).toMatch(/^req_/)
    expect(body.error.code).toBe("rate_limited")
    expect(db.auditRows).toHaveLength(1)
    expect(db.auditRows[0]?.data.metadata).toMatchObject({ reason: "rate_limited", keyPrefix: record.prefix })
    expect(JSON.stringify(db.auditRows)).not.toContain(key)
    expect(readLogs()).not.toContain(key)

    // Another key from the same vendor keeps its own budget.
    const other = storeKey()
    expect((await ping(`Bearer ${other.key}`)).status).toBe(200)
  })

  it("still refuses when the audit write fails, and logs no key", async () => {
    const readLogs = collectConsoleOutput()
    const { key } = storeKey({ revokedAt: new Date() })
    vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error("db down"))

    const response = await ping(`Bearer ${key}`)

    expect(response.status).toBe(401)
    const logs = readLogs()
    expect(logs).toContain("Partner API refusal audit skipped")
    expect(logs).not.toContain(key)
  })
})
