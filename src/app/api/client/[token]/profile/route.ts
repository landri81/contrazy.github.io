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

    const { fullName, email, phone, companyName } = await request.json()

    if (!fullName || !email) {
      return NextResponse.json({ success: false, message: "Name and email are required" }, { status: 400 })
    }

    // Upsert client profile to prevent duplicates per transaction
    let clientProfileId = link.transaction.clientProfileId;

    if (clientProfileId) {
      await prisma.clientProfile.update({
        where: { id: clientProfileId },
        data: {
          fullName,
          email,
          phone,
          companyName
        }
      })
    } else {
      const newProfile = await prisma.clientProfile.create({
        data: {
          vendorId: link.transaction.vendorId,
          fullName,
          email,
          phone,
          companyName
        }
      })
      clientProfileId = newProfile.id;
    }

    // Attach to transaction if it wasn't already
    if (!link.transaction.clientProfileId) {
      await prisma.transaction.update({
        where: { id: link.transaction.id },
        data: { clientProfileId }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Save Profile Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save profile" }, { status: 500 })
  }
}
