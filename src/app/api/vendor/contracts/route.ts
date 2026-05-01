import { NextResponse } from "next/server"
import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export async function POST(request: Request) {
  try {
    const { session, dbUser } = await requireVendorAccess()

    if (!dbUser?.vendorProfile) {
      return NextResponse.json({ success: false, message: "Vendor profile not found" }, { status: 404 })
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
        vendorId: dbUser.vendorProfile.id,
      },
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Create Contract Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create template" }, { status: 500 })
  }
}
