import { type RequirementType } from "@prisma/client"
import { NextResponse } from "next/server"

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

    const { documents } = await request.json()

    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json({ success: false, message: "Invalid document data" }, { status: 400 })
    }

    const transactionId = link.transaction.id

    await markTransactionLinkOpened(prisma, { linkId: link.id, transactionId })

    for (const document of documents as Array<{
      requirementId?: string
      label?: string
      type?: string
      secure_url: string
      public_id: string
      original_filename?: string
    }>) {
      const nextData = {
        transactionId,
        clientProfileId: link.transaction.clientProfileId,
        requirementId: document.requirementId ?? null,
        label: document.label || "Uploaded Document",
        type: (document.type || "DOCUMENT") as RequirementType,
        assetUrl: document.secure_url,
        publicId: document.public_id,
        fileName: document.original_filename || null,
      }

      if (document.requirementId) {
        await prisma.documentAsset.upsert({
          where: {
            transactionId_requirementId: {
              transactionId,
              requirementId: document.requirementId,
            },
          },
          update: nextData,
          create: nextData,
        })
      } else {
        await prisma.documentAsset.create({ data: nextData })
      }
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "DOCS_SUBMITTED" },
    })

    await recordTransactionEvent(prisma, {
      transactionId,
      type: "DOCUMENTS_SUBMITTED",
      title: "Client documents submitted",
      detail: `${documents.length} required file(s) were uploaded.`,
      dedupeKey: `event:documents:${transactionId}`,
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
    console.error("Save Documents Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save documents" }, { status: 500 })
  }
}
