import { NextResponse } from "next/server"

import {
  deleteRequirementExampleAssetIfUnreferenced,
  normalizeRequirementExampleImage,
} from "@/features/dashboard/server/requirement-example-assets"
import { checklistTemplatePayloadSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import {
  ensureVendorPreparationAllowed,
  ensureVendorSubscriptionEligible,
  requireVendorProfileAccess,
} from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

async function getOwnedTemplate(templateId: string, vendorId: string) {
  const existing = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!existing || existing.vendorId !== vendorId) {
    return null
  }

  return existing
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const existing = await getOwnedTemplate(id, vendorProfile.id)

    if (!existing) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsedBody = checklistTemplatePayloadSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid checklist data" },
        { status: 400 }
      )
    }

    const { name, description, items } = parsedBody.data
    const exampleAssetsToCheck = new Set(
      existing.items
        .map((item) => item.exampleImagePublicId)
        .filter((publicId): publicId is string => Boolean(publicId))
    )

    let normalizedItems: Array<{
      label: string
      description: string | null
      type: typeof items[number]["type"]
      category: typeof items[number]["category"]
      customCategoryLabel: string | null
      required: boolean
      exampleImageUrl: string | null
      exampleImagePublicId: string | null
      exampleImageFileName: string | null
    }>

    try {
      normalizedItems = items.map((item) => {
        const normalizedExampleImage = normalizeRequirementExampleImage(item, item.type, vendorProfile.id)
        return {
          label: item.label,
          description: item.description,
          type: item.type,
          category: item.category,
          customCategoryLabel: item.customCategoryLabel,
          required: item.required,
          ...normalizedExampleImage,
        }
      })
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: error instanceof Error ? error.message : "Invalid example image data.",
        },
        { status: 400 }
      )
    }

    const template = await prisma.$transaction(async (tx) => {
      await tx.checklistTemplate.update({
        where: { id },
        data: {
          name,
          description,
          items: {
            deleteMany: {},
            create: normalizedItems.map((item, index) => ({
              label: item.label,
              description: item.description,
              type: item.type,
              category: item.category,
              customCategoryLabel: item.customCategoryLabel,
              required: item.required,
              exampleImageUrl: item.exampleImageUrl,
              exampleImagePublicId: item.exampleImagePublicId,
              exampleImageFileName: item.exampleImageFileName,
              sortOrder: index,
            })),
          },
        },
      })

      return tx.checklistTemplate.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    })

    await Promise.allSettled(
      Array.from(exampleAssetsToCheck).map((publicId) =>
        deleteRequirementExampleAssetIfUnreferenced({ publicId })
      )
    )

    return NextResponse.json(template)
  } catch (error) {
    console.error("Update Checklist Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to update template" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const existing = await getOwnedTemplate(id, vendorProfile.id)

    if (!existing) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    const exampleAssetsToCheck = Array.from(
      new Set(
        existing.items
          .map((item) => item.exampleImagePublicId)
          .filter((publicId): publicId is string => Boolean(publicId))
      )
    )

    await prisma.checklistTemplate.delete({
      where: { id },
    })

    await Promise.allSettled(
      exampleAssetsToCheck.map((publicId) =>
        deleteRequirementExampleAssetIfUnreferenced({ publicId })
      )
    )

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Delete Checklist Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete template" }, { status: 500 })
  }
}
