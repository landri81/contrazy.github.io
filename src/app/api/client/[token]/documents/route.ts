import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const link = await prisma.transactionLink.findUnique({
      where: { token },
      include: { transaction: true }
    })

    if (!link || !link.transaction) {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    const { documents } = await request.json()

    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json({ success: false, message: "Invalid document data" }, { status: 400 })
    }

    // Process array of document results from Cloudinary 
    const createData = documents.map((doc: { label?: string, type?: string, secure_url: string, public_id: string, original_filename?: string }) => ({
      transactionId: link.transaction.id,
      clientProfileId: link.transaction.clientProfileId,
      label: doc.label || "Uploaded Document",
      type: (doc.type || "DOCUMENT") as import("@prisma/client").RequirementType,
      assetUrl: doc.secure_url,
      publicId: doc.public_id,
      fileName: doc.original_filename || null
    }))

    if (createData.length > 0) {
      await prisma.documentAsset.createMany({
        data: createData
      })
    }

    // Note: status automatically advances when we check progress in validateClientStep

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Save Documents Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save documents" }, { status: 500 })
  }
}
