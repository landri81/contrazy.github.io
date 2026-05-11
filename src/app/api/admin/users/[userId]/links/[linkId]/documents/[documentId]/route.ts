import { TransactionStatus } from "@prisma/client"
import { NextResponse } from "next/server"

import { destroyDocumentCloudinaryAsset } from "@/features/client-flow/server/client-document-assets"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { canAccessAdminScope } from "@/lib/auth/roles"
import { getAuthSession } from "@/lib/auth/session"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ userId: string; linkId: string; documentId: string }>
  }
) {
  try {
    const session = await getAuthSession()

    if (!session?.user?.email || !canAccessAdminScope(session.user.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, message: "Only a super admin can delete submitted documents." }, { status: 403 })
    }

    const { userId, linkId, documentId } = await params

    const link = await prisma.transactionLink.findFirst({
      where: {
        id: linkId,
        transaction: {
          vendor: {
            userId,
          },
        },
      },
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            requirements: {
              select: {
                id: true,
                type: true,
                required: true,
              },
            },
            documents: {
              select: {
                id: true,
                label: true,
                type: true,
                fileName: true,
                assetUrl: true,
                textValue: true,
                publicId: true,
                requirementId: true,
              },
            },
          },
        },
      },
    })

    if (!link) {
      return NextResponse.json({ success: false, message: "Link record not found." }, { status: 404 })
    }

    const document = link.transaction.documents.find((entry) => entry.id === documentId)

    if (!document) {
      return NextResponse.json({ success: false, message: "Document not found." }, { status: 404 })
    }

    const remainingDocuments = link.transaction.documents.filter((entry) => entry.id !== document.id)
    const requiredRequirements = link.transaction.requirements.filter((requirement) => requirement.required)
    const stillHasRequiredDocuments = requiredRequirements.every((requirement) =>
      remainingDocuments.some(
        (entry) =>
          entry.requirementId === requirement.id &&
          (requirement.type === "TEXT" ? Boolean(entry.textValue?.trim()) : Boolean(entry.assetUrl))
      )
    )

    const nextStatus =
      link.transaction.status === TransactionStatus.DOCS_SUBMITTED && !stillHasRequiredDocuments
        ? TransactionStatus.CUSTOMER_STARTED
        : null

    const actor = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    })

    await prisma.$transaction(async (tx) => {
      await tx.documentAsset.delete({
        where: { id: document.id },
      })

      if (nextStatus) {
        await tx.transaction.update({
          where: { id: link.transaction.id },
          data: { status: nextStatus },
        })
      }

      await tx.auditLog.create({
        data: {
          actorId: actor?.id ?? null,
          actorType: "SUPER_ADMIN",
          action: "Deleted submitted document from admin workspace",
          entityType: "Transaction",
          entityId: link.transaction.id,
          metadata: {
            linkId,
            documentId: document.id,
            label: document.label,
            type: document.type,
            revertedStatus: nextStatus,
          },
        },
      })

      await recordTransactionEvent(tx, {
        transactionId: link.transaction.id,
        type: "LINK_UPDATED",
        title: "Supporting document removed",
        detail: `Super admin removed "${document.label}" from the link record.`,
        metadata: {
          linkId,
          documentId: document.id,
          label: document.label,
          type: document.type,
        },
      })
    })

    if (document.publicId || document.assetUrl) {
      try {
        await destroyDocumentCloudinaryAsset({
          publicId: document.publicId,
          assetUrl: document.assetUrl,
          fileName: document.fileName,
        })
      } catch (error) {
        console.warn("Cloudinary cleanup failed after admin document deletion", error)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin document delete failed", error)
    return NextResponse.json(
      { success: false, message: "Unable to delete this document." },
      { status: 500 }
    )
  }
}
