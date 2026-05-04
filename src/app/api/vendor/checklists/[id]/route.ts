import { NextResponse } from "next/server"
import { ensureVendorPreparationAllowed, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

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
    const existing = await prisma.checklistTemplate.findUnique({
      where: { id: templateId },
    })

    if (!existing || existing.vendorId !== vendorProfile.id) {
      return NextResponse.json({ success: false, message: "Template not found" }, { status: 404 })
    }

    await prisma.checklistTemplate.delete({
      where: { id: templateId },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Delete Checklist Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to delete template" }, { status: 500 })
  }
}
