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
      include: { transaction: { include: { clientProfile: true } } }
    })

    if (!link || !link.transaction) {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    const { agreed } = await request.json()

    if (!agreed) {
      return NextResponse.json({ success: false, message: "Signature required" }, { status: 400 })
    }

    // Create signature record
    await prisma.signatureRecord.create({
      data: {
        transactionId: link.transaction.id,
        status: "SIGNED",
        signerName: link.transaction.clientProfile?.fullName || "Unknown",
        signerEmail: link.transaction.clientProfile?.email || "Unknown",
        method: "Checkbox Acceptance",
        signedAt: new Date()
      }
    })

    // Advance status to SIGNED
    await prisma.transaction.update({
      where: { id: link.transaction.id },
      data: { status: "SIGNED" }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Save Signature Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save signature" }, { status: 500 })
  }
}
