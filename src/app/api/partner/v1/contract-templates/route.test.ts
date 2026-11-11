import { beforeEach, describe, expect, it, vi } from "vitest"

import { generatePartnerApiKey } from "@/lib/partner-api/keys"
import { partnerApiRateLimiter } from "@/lib/partner-api/rate-limit"

/** GET /contract-templates (LOCAZ, 11 Nov 2026): the vendor's own contracts, default first, never their text. */

const db = vi.hoisted(() => ({ keys: [] as Array<Record<string, unknown>>, templates: [] as Array<Record<string, unknown>> }))

vi.mock("@/lib/db/prisma", () => {
  const vendor = { id: "vendor_1", businessName: "LOCAZ" }
  return {
    prisma: {
      partnerApiKey: {
        findUnique: vi.fn(async ({ where }: { where: { hashedKey: string } }) => {
          const key = db.keys.find((item) => item.hashedKey === where.hashedKey)
          return key ? { ...key, vendor } : null
        }),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      auditLog: { create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: "audit_1", ...args.data })) },
      contractTemplate: {
        findMany: vi.fn(async ({ where, select }: { where: { vendorId: string }; select: Record<string, boolean> }) =>
          db.templates
            .filter((template) => template.vendorId === where.vendorId)
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
            .map((template) => Object.fromEntries(Object.keys(select).map((field) => [field, template[field]])))
        ),
      },
    },
  }
})

const { GET } = await import("@/app/api/partner/v1/contract-templates/route")

function storeKey(scopes: string[]) {
  const generated = generatePartnerApiKey("TEST")
  db.keys.push({ id: `key_${db.keys.length + 1}`, vendorId: "vendor_1", name: "LOCAZ", prefix: generated.prefix, hashedKey: generated.hashedKey, scopes, mode: "TEST", lastUsedAt: null, createdById: "user_1", revokedAt: null, createdAt: new Date("2026-11-01T08:00:00Z") })
  return generated.key
}

const list = (key: string) => GET(new Request("http://localhost/api/partner/v1/contract-templates", { headers: { authorization: `Bearer ${key}`, "x-forwarded-for": "203.0.113.7" } }), { params: Promise.resolve({}) })

beforeEach(() => {
  db.keys.length = 0
  db.templates.length = 0
  partnerApiRateLimiter.reset()
})

describe("GET /api/partner/v1/contract-templates", () => {
  it("lists the vendor's contracts, the default first, without their text", async () => {
    const key = storeKey(["bookings:read"])
    db.templates.push(
      { id: "ct_van", vendorId: "vendor_1", name: "LOCAZ Utilitaire", description: "Fourgons", isDefault: false, content: "Article 1…", createdAt: new Date("2026-11-11T08:00:00Z"), updatedAt: new Date("2026-11-11T09:00:00Z") },
      { id: "ct_daily", vendorId: "vendor_1", name: "LOCAZ Daily LCD", description: null, isDefault: true, content: "Article 1…", createdAt: new Date("2026-10-01T08:00:00Z"), updatedAt: new Date("2026-11-09T08:00:00Z") },
      { id: "ct_other", vendorId: "vendor_2", name: "Someone else's", description: null, isDefault: true, content: "…", createdAt: new Date(), updatedAt: new Date() }
    )

    const response = await list(key)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toEqual([
      { id: "ct_daily", name: "LOCAZ Daily LCD", description: null, isDefault: true, updatedAt: "2026-11-09T08:00:00.000Z" },
      { id: "ct_van", name: "LOCAZ Utilitaire", description: "Fourgons", isDefault: false, updatedAt: "2026-11-11T09:00:00.000Z" },
    ])
    expect(JSON.stringify(body)).not.toContain("Article 1")
  })

  it("needs the bookings:read scope", async () => {
    const response = await list(storeKey(["charges:write"]))
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe("insufficient_scope")
  })
})
