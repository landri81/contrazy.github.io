import { beforeEach, describe, expect, it, vi } from "vitest"

import { generatePartnerApiKey } from "@/lib/partner-api/keys"
import { partnerApiRateLimiter } from "@/lib/partner-api/rate-limit"

/** GET /checklists (LOCAZ, 11 Nov 2026): the vendor's own checklists, items in order, with their example images. */

const db = vi.hoisted(() => ({ keys: [] as Array<Record<string, unknown>>, checklists: [] as Array<Record<string, unknown>> }))

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
      checklistTemplate: {
        findMany: vi.fn(async ({ where }: { where: { vendorId: string } }) => db.checklists.filter((checklist) => checklist.vendorId === where.vendorId)),
      },
    },
  }
})

const { GET } = await import("@/app/api/partner/v1/checklists/route")

function storeKey(scopes: string[]) {
  const generated = generatePartnerApiKey("TEST")
  db.keys.push({ id: `key_${db.keys.length + 1}`, vendorId: "vendor_1", name: "LOCAZ", prefix: generated.prefix, hashedKey: generated.hashedKey, scopes, mode: "TEST", lastUsedAt: null, createdById: "user_1", revokedAt: null, createdAt: new Date("2026-11-01T08:00:00Z") })
  return generated.key
}

const list = (key: string) => GET(new Request("http://localhost/api/partner/v1/checklists", { headers: { authorization: `Bearer ${key}`, "x-forwarded-for": "203.0.113.7" } }), { params: Promise.resolve({}) })

const item = (sortOrder: number, label: string, extra: Record<string, unknown> = {}) => ({
  id: `item_${sortOrder}`, templateId: "chk_photos", label, description: null, type: "PHOTO", category: "OTHER", customCategoryLabel: "Photos départ",
  requiredFileCount: 1, fileSlotLabels: null, exampleImageUrl: null, exampleImagePublicId: null, exampleImageFileName: null, required: true, sortOrder, ...extra,
})

beforeEach(() => {
  db.keys.length = 0
  db.checklists.length = 0
  partnerApiRateLimiter.reset()
})

describe("GET /api/partner/v1/checklists", () => {
  it("lists the vendor's checklists with items in order, slot labels and example images", async () => {
    const key = storeKey(["bookings:read"])
    db.checklists.push(
      {
        id: "chk_photos", vendorId: "vendor_1", name: "Photos véhicule utilitaire", description: "Prendre les photos", createdAt: new Date("2026-05-16T08:00:00Z"), updatedAt: new Date("2026-07-02T08:00:00Z"),
        items: [
          item(1, "Photo véhicule - Droite", { fileSlotLabels: ["Droite"] }),
          item(0, "Photo véhicule - Face", { exampleImageUrl: "https://res.cloudinary.com/contrazy/image/upload/v1/face.jpg", exampleImagePublicId: "vendors/vendor_1/face", exampleImageFileName: "face.jpg" }),
        ],
      },
      { id: "chk_other", vendorId: "vendor_2", name: "Someone else's", description: null, createdAt: new Date(), updatedAt: new Date(), items: [] }
    )

    const response = await list(key)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ id: "chk_photos", name: "Photos véhicule utilitaire", updatedAt: "2026-07-02T08:00:00.000Z" })
    expect(body.data[0].items.map((entry: { label: string }) => entry.label)).toEqual(["Photo véhicule - Face", "Photo véhicule - Droite"])
    expect(body.data[0].items[0]).toEqual({
      id: "item_0", label: "Photo véhicule - Face", description: null, type: "PHOTO", category: "OTHER", customCategoryLabel: "Photos départ", required: true, fileCount: 1,
      slotLabels: ["Photo véhicule - Face"],
      exampleImage: { url: "https://res.cloudinary.com/contrazy/image/upload/v1/face.jpg", publicId: "vendors/vendor_1/face", fileName: "face.jpg" },
    })
    expect(body.data[0].items[1]).toMatchObject({ slotLabels: ["Droite"], exampleImage: null })
  })

  it("needs the bookings:read scope", async () => {
    const response = await list(storeKey(["charges:write"]))
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe("insufficient_scope")
  })
})
