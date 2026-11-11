import { beforeEach, describe, expect, it, vi } from "vitest"

/** Duplicating a checklist (LOCAZ, 11 Nov 2026): a copy with every item and example image, for the owner only. */

const db = vi.hoisted(() => ({ templates: [] as Array<Record<string, unknown>>, created: [] as Array<Record<string, unknown>> }))

vi.mock("@/lib/auth/guards", () => ({
  requireVendorProfileAccess: vi.fn(async () => ({ vendorProfile: { id: "vendor_1" } })),
  ensureVendorSubscriptionEligible: vi.fn(async () => ({ response: null })),
  ensureVendorPreparationAllowed: vi.fn(() => null),
}))
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    checklistTemplate: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => db.templates.find((template) => template.id === where.id) ?? null),
      create: vi.fn(async ({ data }: { data: { items: { create: unknown[] } } & Record<string, unknown> }) => {
        const copy = { id: "chk_copy", ...data, items: data.items.create }
        db.created.push(copy)
        return copy
      }),
    },
  },
}))

const { POST } = await import("@/app/api/vendor/checklists/[id]/duplicate/route")

const duplicate = (id: string, body?: unknown) =>
  POST(new Request(`http://localhost/api/vendor/checklists/${id}/duplicate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), { params: Promise.resolve({ id }) })

const item = (sortOrder: number, label: string, extra: Record<string, unknown> = {}) => ({
  id: `item_${sortOrder}`, templateId: "chk_photos", label, description: null, type: "PHOTO", category: "OTHER", customCategoryLabel: "Photos départ",
  requiredFileCount: 1, fileSlotLabels: [label], exampleImageUrl: null, exampleImagePublicId: null, exampleImageFileName: null, required: true, sortOrder, ...extra,
})

beforeEach(() => {
  db.templates.length = 0
  db.created.length = 0
  db.templates.push(
    {
      id: "chk_photos", vendorId: "vendor_1", name: "Photos véhicule utilitaire", description: "Prendre les photos",
      items: [item(0, "Face", { exampleImageUrl: "https://res.cloudinary.com/x/face.jpg", exampleImagePublicId: "vendors/vendor_1/face", exampleImageFileName: "face.jpg" }), item(1, "Droite")],
    },
    { id: "chk_other", vendorId: "vendor_2", name: "Not mine", description: null, items: [] }
  )
})

describe("POST /api/vendor/checklists/:id/duplicate", () => {
  it("copies the checklist with its items in order and the same example images, under the name sent", async () => {
    const response = await duplicate("chk_photos", { name: "Photos véhicule utilitaire (copie)" })
    expect(response.status).toBe(201)
    const copy = db.created[0] as { name: string; vendorId: string; description: string; items: Array<Record<string, unknown>> }
    expect(copy).toMatchObject({ name: "Photos véhicule utilitaire (copie)", vendorId: "vendor_1", description: "Prendre les photos" })
    expect(copy.items.map((entry) => entry.label)).toEqual(["Face", "Droite"])
    expect(copy.items[0]).toMatchObject({ exampleImageUrl: "https://res.cloudinary.com/x/face.jpg", exampleImagePublicId: "vendors/vendor_1/face", sortOrder: 0, required: true })
  })

  it("names the copy after the original when no name is sent", async () => {
    await duplicate("chk_photos")
    expect((db.created[0] as { name: string }).name).toBe("Photos véhicule utilitaire (copy)")
  })

  it("refuses another vendor's checklist", async () => {
    const response = await duplicate("chk_other")
    expect(response.status).toBe(404)
    expect(db.created).toHaveLength(0)
  })
})
