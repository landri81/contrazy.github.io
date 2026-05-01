import { NextResponse } from "next/server"
import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { RequirementType } from "@prisma/client"

export async function POST(request: Request) {
  try {
    const { session, dbUser } = await requireVendorAccess()

    if (!dbUser?.vendorProfile) {
      return NextResponse.json({ success: false, message: "Vendor profile not found" }, { status: 404 })
    }

    const { name, description, items } = await request.json()

    if (!name) {
      return NextResponse.json({ success: false, message: "Name is required" }, { status: 400 })
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        name,
        description,
        vendorId: dbUser.vendorProfile.id,
        items: {
          create: items.map((item: { label: string, description: string, type: RequirementType, required: boolean }, i: number) => ({
            label: item.label,
            description: item.description,
            type: item.type,
            required: item.required,
            sortOrder: i,
          }))
        }
      },
      include: {
        items: true
      }
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error("Create Checklist Template Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create template" }, { status: 500 })
  }
}
