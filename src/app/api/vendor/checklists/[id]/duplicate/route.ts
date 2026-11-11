import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { ensureVendorPreparationAllowed, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"

/**
 * Duplicates one of the vendor's checklists with all its items and example images (LOCAZ, 11 Nov 2026: a checklist for
 * another type of vehicle starts from the existing one). The copies share the example images: an image is deleted
 * only once no checklist or transaction refers to it (deleteRequirementExampleAssetIfUnreferenced).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)
    if (response) return response
    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)
    if (blockedResponse) return blockedResponse

    const source = await prisma.checklistTemplate.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } })
    if (!source || source.vendorId !== vendorProfile.id) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as { name?: unknown } | null
    const requested = typeof body?.name === "string" ? body.name.trim() : ""
    const name = (requested || `${source.name} (copy)`).slice(0, INPUT_LIMITS.checklistName)

    const copy = await prisma.checklistTemplate.create({
      data: {
        vendorId: vendorProfile.id,
        name,
        description: source.description,
        items: {
          create: source.items.map((item, index) => ({
            label: item.label,
            description: item.description,
            type: item.type,
            category: item.category,
            customCategoryLabel: item.customCategoryLabel,
            required: item.required,
            requiredFileCount: item.requiredFileCount,
            fileSlotLabels: (item.fileSlotLabels ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            exampleImageUrl: item.exampleImageUrl,
            exampleImagePublicId: item.exampleImagePublicId,
            exampleImageFileName: item.exampleImageFileName,
            sortOrder: index,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    })
    return NextResponse.json(copy, { status: 201 })
  } catch (error) {
    console.error("Duplicate Checklist Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to duplicate the checklist" }, { status: 500 })
  }
}
