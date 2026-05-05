import { NextResponse } from "next/server"

import { clientProfileSchema } from "@/features/client-flow/schemas/client-profile.schema"
import { clientFlowTransactionInclude, getNextClientStep } from "@/features/client-flow/server/client-flow-data"
import { completeTransactionWithoutPayment } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext, markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json({ success: false, message: "This secure link is no longer available." }, { status: 410 })
    }

    const { link } = linkContext

    const body = await request.json()
    const parsedBody = clientProfileSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, message: parsedBody.error.issues[0]?.message ?? "Invalid profile details." },
        { status: 400 }
      )
    }

    const { firstName, lastName, fullName, email, phone, companyName, address, country } = parsedBody.data

    const transactionId = link.transaction.id

    if (link.transaction.requireClientCompany && !companyName) {
      return NextResponse.json(
        { success: false, message: "Company name is required for this transaction." },
        { status: 400 }
      )
    }

    await markTransactionLinkOpened(prisma, { linkId: link.id, transactionId })

    let clientProfileId = link.transaction.clientProfileId

    if (clientProfileId) {
      await prisma.clientProfile.update({
        where: { id: clientProfileId },
        data: { firstName, lastName, fullName, email, phone, companyName, address, country },
      })
    } else {
      const newProfile = await prisma.clientProfile.create({
        data: {
          vendorId: link.transaction.vendorId,
          firstName,
          lastName,
          fullName,
          email,
          phone,
          companyName,
          address,
          country,
        },
      })
      clientProfileId = newProfile.id
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { clientProfileId, status: "CUSTOMER_STARTED" },
    })

    await recordTransactionEvent(prisma, {
      transactionId,
      type: "PROFILE_SUBMITTED",
      title: "Client profile submitted",
      detail: `${fullName} shared contact details.`,
      dedupeKey: `event:profile:${transactionId}`,
    })

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: clientFlowTransactionInclude,
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    const nextStep = getNextClientStep(transaction)

    if (nextStep === "complete") {
      await completeTransactionWithoutPayment(prisma, transactionId)
    }

    return NextResponse.json({ success: true, nextStep })
  } catch (error) {
    console.error("Save Profile Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save profile" }, { status: 500 })
  }
}
