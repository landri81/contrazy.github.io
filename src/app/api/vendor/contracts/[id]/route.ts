import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureVendorPreparationAllowed, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { extractManagedContractTemplateInlineImageAssets } from "@/features/contracts/contract-template-inline-assets"
import { stripContractMarkup } from "@/features/contracts/contract-content"
import {
  assertValidVendorContractTemplateInlineImages,
  deleteContractTemplateInlineImageIfUnreferenced,
} from "@/features/contracts/server/contract-template-assets"
import { setDefaultContractTemplate } from "@/features/contracts/server/default-template"
import { contractTemplatePayloadSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { sanitizeContractTemplateContent } from "@/features/contracts/server/contract-rendering"
import { prisma } from "@/lib/db/prisma"

export async function PUT(
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

    const body = await request.json()
    const parsedBody = contractTemplatePayloadSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid template data" },
        { status: 400 }
      )
    }

    const { name, description, content } = parsedBody.data
    const sanitizedContent = sanitizeContractTemplateContent(content)
    assertValidVendorContractTemplateInlineImages(sanitizedContent, vendorProfile.id)

    if (!stripContractMarkup(sanitizedContent).trim()) {
      return NextResponse.json(
        { success: false, message: "Contract content is required" },
        { status: 400 }
      )
    }

    const templateId = id

    // Ensure vendor owns the template
    const existing = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
    })

    if (!existing || existing.vendorId !== vendorProfile.id) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    const previousAssets = extractManagedContractTemplateInlineImageAssets(existing.content)
    const nextAssets = extractManagedContractTemplateInlineImageAssets(sanitizedContent)
    const nextPublicIds = new Set(nextAssets.map((asset) => asset.publicId))
    const removedAssets = previousAssets.filter((asset) => !nextPublicIds.has(asset.publicId))

    const updated = await prisma.contractTemplate.update({
      where: { id: templateId },
      data: {
        name,
        description,
        content: sanitizedContent,
      },
    })

    await Promise.allSettled(
      removedAssets.map((asset) =>
        deleteContractTemplateInlineImageIfUnreferenced(asset.publicId, {
          ignoreTemplateId: templateId,
        })
      )
    )

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update Contract Template Error:", error)
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

    const templateId = id

    // Ensure vendor owns the template
    const existing = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
    })

    if (!existing || existing.vendorId !== vendorProfile.id) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    const existingAssets = extractManagedContractTemplateInlineImageAssets(existing.content)

    await prisma.contractTemplate.delete({
      where: { id: templateId },
    })

    await Promise.allSettled(
      existingAssets.map((asset) => deleteContractTemplateInlineImageIfUnreferenced(asset.publicId))
    )

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Delete Contract Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete template" }, { status: 500 })
  }
}

const setDefaultSchema = z.object({ isDefault: z.literal(true) })

/** Makes this template the default: the contract partner bookings (LOCAZ) use when they name no template. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { dbUser, vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    if (!setDefaultSchema.safeParse(await request.json().catch(() => null)).success) {
      return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
    }

    const updated = await setDefaultContractTemplate(vendorProfile.id, id, dbUser.id)

    if (!updated) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Set Default Contract Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to set the default template" }, { status: 500 })
  }
}
