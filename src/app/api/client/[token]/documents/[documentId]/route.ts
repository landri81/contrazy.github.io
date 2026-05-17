import { TransactionStatus } from "@prisma/client"
import { NextResponse } from "next/server"

import { destroyDocumentCloudinaryAssetIfUnreferenced } from "@/features/client-flow/server/client-document-assets"
import { canRevisitClientStep, clientFlowTransactionInclude } from "@/features/client-flow/server/client-flow-data"
import { isRequirementSlotSatisfied } from "@/features/transactions/contract-flow"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ token: string; documentId: string }>
  }
) {
  try {
    const { token, documentId } = await params
    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
    }

    if (linkContext.state === "cancelled") {
      return NextResponse.json(
        { success: false, message: "This secure link is no longer available." },
        { status: 410 }
      )
    }

    const currentTransaction = await prisma.transaction.findUnique({
      where: { id: linkContext.link.transaction.id },
      include: clientFlowTransactionInclude,
    })

    if (!currentTransaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    if (!canRevisitClientStep(currentTransaction, "documents")) {
      return NextResponse.json(
        { success: false, message: "Documents can no longer be changed after payment has started." },
        { status: 409 }
      )
    }

    const document = currentTransaction.documents.find((entry) => entry.id === documentId)

    if (!document) {
      return NextResponse.json({ success: false, message: "Document not found." }, { status: 404 })
    }

    const remainingDocuments = currentTransaction.documents.filter((entry) => entry.id !== document.id)
    const requiredRequirements = currentTransaction.requirements.filter((requirement) => requirement.required)
    const stillHasRequiredDocuments = requiredRequirements.every((requirement) =>
      isRequirementSlotSatisfied(requirement, remainingDocuments)
    )

    const nextStatus =
      currentTransaction.status === TransactionStatus.DOCS_SUBMITTED && !stillHasRequiredDocuments
        ? TransactionStatus.CUSTOMER_STARTED
        : null

    await prisma.$transaction(async (tx) => {
      await tx.documentAsset.delete({
        where: { id: document.id },
      })

      if (nextStatus) {
        await tx.transaction.update({
          where: { id: currentTransaction.id },
          data: { status: nextStatus },
        })
      }

      await recordTransactionEvent(tx, {
        transactionId: currentTransaction.id,
        type: "LINK_UPDATED",
        title: "Supporting document removed",
        detail: `Client removed "${document.label}" from the document step.`,
        metadata: {
          documentId: document.id,
          label: document.label,
          type: document.type,
          slotIndex: document.slotIndex,
          slotLabel: document.slotLabel,
          revertedStatus: nextStatus,
        },
      })
    })

    if (document.publicId || document.assetUrl) {
      try {
        await destroyDocumentCloudinaryAssetIfUnreferenced({
          publicId: document.publicId,
          assetUrl: document.assetUrl,
          fileName: document.fileName,
        })
      } catch (error) {
        console.warn("Cloudinary cleanup failed after client document deletion", error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Client document delete failed", error)
    return NextResponse.json(
      { success: false, message: "Unable to delete this document." },
      { status: 500 }
    )
  }
}
