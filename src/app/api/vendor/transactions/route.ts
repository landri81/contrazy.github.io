import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { requireVendorAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export async function POST(request: Request) {
  try {
    const { session, dbUser } = await requireVendorAccess()

    if (!dbUser?.vendorProfile) {
      return NextResponse.json({ success: false, message: "Vendor profile not found" }, { status: 404 })
    }

    const body = await request.json()
    const { 
      title, 
      notes, 
      contractTemplateId, 
      checklistTemplateId, 
      amount, 
      depositAmount, 
      requiresKyc 
    } = body

    if (!title) {
      return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 })
    }

    const vendorId = dbUser.vendorProfile.id
    const reference = `TX-${randomBytes(4).toString('hex').toUpperCase()}`
    const token = randomBytes(16).toString('hex')

    // Determine transaction kind
    let kind: "PAYMENT" | "DEPOSIT" | "HYBRID" = "HYBRID"
    if (amount && !depositAmount) kind = "PAYMENT"
    if (!amount && depositAmount) kind = "DEPOSIT"
    
    // Begin creation logic
    const transaction = await prisma.$transaction(async (tx) => {
      // Create base transaction
      const newTx = await tx.transaction.create({
        data: {
          vendorId,
          reference,
          title,
          notes,
          kind,
          amount: amount || null,
          depositAmount: depositAmount || null,
          requiresKyc: !!requiresKyc,
          contractTemplateId: contractTemplateId || null,
          checklistTemplateId: checklistTemplateId || null,
          status: "LINK_SENT" // Move to sent automatically since we generate the link immediately
        }
      })

      // Create the secure link
      const link = await tx.transactionLink.create({
        data: {
          transactionId: newTx.id,
          token,
          // Generate a 6 character short code for potential future SMS use
          shortCode: randomBytes(3).toString('hex').toUpperCase(),
        }
      })

      // If a checklist was selected, copy its items into the transaction requirements
      if (checklistTemplateId) {
        const template = await tx.checklistTemplate.findUnique({
          where: { id: checklistTemplateId },
          include: { items: true }
        })

        if (template && template.items.length > 0) {
          await tx.transactionRequirement.createMany({
            data: template.items.map(item => ({
              transactionId: newTx.id,
              label: item.label,
              instructions: item.description,
              type: item.type,
              required: item.required,
            }))
          })
        }
      }

      return { ...newTx, link }
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error("Create Transaction Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create transaction" }, { status: 500 })
  }
}
