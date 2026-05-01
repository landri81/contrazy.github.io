import { type RequirementType } from "@prisma/client"
import { NextResponse } from "next/server"

import { clientFlowTransactionInclude, getNextClientStep } from "@/features/client-flow/server/client-flow-data"
import { completeTransactionWithoutPayment } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { prisma } from "@/lib/db/prisma"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const link = await prisma.transactionLink.findUnique({
      where: { token },
      include: { transaction: true },
    })

    if (!link?.transaction) {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    const { documents } = await request.json()

    if (!documents || !Array.isArray(documents)) {
      return NextResponse.json({ success: false, message: "Invalid document data" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      for (const document of documents as Array<{
        requirementId?: string
        label?: string
        type?: string
        secure_url: string
        public_id: string
        original_filename?: string
      }>) {
        const nextData = {
          transactionId: link.transaction.id,
          clientProfileId: link.transaction.clientProfileId,
          requirementId: document.requirementId ?? null,
          label: document.label || "Uploaded Document",
          type: (document.type || "DOCUMENT") as RequirementType,
          assetUrl: document.secure_url,
          publicId: document.public_id,
          fileName: document.original_filename || null,
        }

        if (document.requirementId) {
          await tx.documentAsset.upsert({
            where: {
              transactionId_requirementId: {
                transactionId: link.transaction.id,
                requirementId: document.requirementId,
              },
            },
            update: nextData,
            create: nextData,
          })
        } else {
          await tx.documentAsset.create({ data: nextData })
        }
      }

      await tx.transaction.update({
        where: { id: link.transaction.id },
        data: { status: "DOCS_SUBMITTED" },
      })

      await recordTransactionEvent(tx, {
        transactionId: link.transaction.id,
        type: "DOCUMENTS_SUBMITTED",
        title: "Client documents submitted",
        detail: `${documents.length} required file(s) were uploaded.`,
        dedupeKey: `event:documents:${link.transaction.id}`,
      })
    })

    const transaction = await prisma.transaction.findUnique({
      where: { id: link.transaction.id },
      include: clientFlowTransactionInclude,
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    const nextStep = getNextClientStep(transaction)

    if (nextStep === "complete") {
      await completeTransactionWithoutPayment(prisma, transaction.id)
    }

    return NextResponse.json({ success: true, nextStep })
  } catch (error) {
    console.error("Save Documents Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save documents" }, { status: 500 })
  }
}
