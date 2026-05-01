import { NextResponse } from "next/server"
import { ensureVendorPreparationAllowed, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const { name, description, content } = await request.json()

    if (!name || !content) {
      return NextResponse.json({ success: false, message: "Name and content are required" }, { status: 400 })
    }

    const template = await prisma.contractTemplate.create({
      data: {
        name,
        description,
        content,
        vendorId: vendorProfile.id,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Create Contract Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create template" }, { status: 500 })
  }
}
