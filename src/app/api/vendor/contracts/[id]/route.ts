import { NextResponse } from "next/server"
import { ensureVendorPreparationAllowed, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { vendorProfile } = await requireVendorProfileAccess()
    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const { name, description, content } = await request.json()
    const templateId = id

    // Ensure vendor owns the template
    const existing = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
    })

    if (!existing || existing.vendorId !== vendorProfile.id) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    const updated = await prisma.contractTemplate.update({
      where: { id: templateId },
      data: {
        name,
        description,
        content,
      },
    })

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

    await prisma.contractTemplate.delete({
      where: { id: templateId },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Delete Contract Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete template" }, { status: 500 })
  }
}
