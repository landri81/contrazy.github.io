import { type RequirementType } from "@prisma/client"
import { NextResponse } from "next/server"

import {
  canRevisitClientStep,
  clientFlowTransactionInclude,
  getNextClientStep,
} from "@/features/client-flow/server/client-flow-data"
import { destroyDocumentCloudinaryAssetIfUnreferenced } from "@/features/client-flow/server/client-document-assets"
import { completeTransactionWithoutPayment } from "@/features/transactions/server/transaction-finance"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext, markTransactionLinkOpened } from "@/features/transactions/server/transaction-links"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"

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
    const currentTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
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

    await markTransactionLinkOpened(prisma, { linkId: link.id, transactionId })

    const requirements = await prisma.transactionRequirement.findMany({
      where: { transactionId },
    })
    const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
    const existingDocuments = await prisma.documentAsset.findMany({
      where: { transactionId },
    })
    const existingDocumentsByRequirementId = new Map(
      existingDocuments
        .filter((document) => Boolean(document.requirementId))
        .map((document) => [document.requirementId as string, document])
    )
    const submittedRequirementIds = new Set<string>()

    for (const requirement of requirements.filter((entry) => entry.required)) {
      const matchingDocument = (documents as Array<{
        requirementId?: string
        secure_url?: string
        public_id?: string
        textValue?: string
      }>).find((document) => document.requirementId === requirement.id)

      if (requirement.type === "TEXT") {
        if (!matchingDocument?.textValue?.trim()) {
          return NextResponse.json(
            { success: false, message: "Complete every required text field before continuing." },
            { status: 400 }
          )
        }

        continue
      }

      if (!matchingDocument?.secure_url || !matchingDocument?.public_id) {
        return NextResponse.json(
          { success: false, message: "Upload every required file before continuing." },
          { status: 400 }
        )
      }
    }

    const assetsToCleanup: Array<{
      publicId?: string | null
      assetUrl?: string | null
      fileName?: string | null
    }> = []

    const validatedDocuments: Array<{
      requirementId?: string
      label?: string
      type: RequirementType
      secure_url?: string
      public_id?: string
      original_filename?: string
      textValue?: string | null
    }> = []

    for (const document of documents as Array<{
      requirementId?: string
      label?: string
      type?: string
      secure_url?: string
      public_id?: string
      original_filename?: string
      textValue?: string
    }>) {
      const requirement = document.requirementId ? requirementsById.get(document.requirementId) : null
      const resolvedType = (document.type || requirement?.type || "DOCUMENT") as RequirementType
      const trimmedTextValue = typeof document.textValue === "string" ? document.textValue.trim() : null

      if (document.requirementId && !requirement) {
        return NextResponse.json({ success: false, message: "A requested requirement could not be found." }, { status: 400 })
      }

      if (document.requirementId) {
        if (submittedRequirementIds.has(document.requirementId)) {
          return NextResponse.json(
            { success: false, message: "Duplicate document entries were submitted." },
            { status: 400 }
          )
        }

        submittedRequirementIds.add(document.requirementId)
      }

      if (resolvedType === "TEXT" && !trimmedTextValue) {
        return NextResponse.json({ success: false, message: "Complete every required text field before continuing." }, { status: 400 })
      }

      if (resolvedType !== "TEXT" && (!document.secure_url || !document.public_id)) {
        return NextResponse.json({ success: false, message: "Upload every required file before continuing." }, { status: 400 })
      }

      validatedDocuments.push({
        ...document,
        type: resolvedType,
        textValue: trimmedTextValue,
      })
    }

    const documentsToDelete = existingDocuments.filter(
      (document) => document.requirementId && !submittedRequirementIds.has(document.requirementId)
    )

    await prisma.$transaction(async (tx) => {
      for (const document of validatedDocuments) {
        const requirement = document.requirementId ? requirementsById.get(document.requirementId) : null
        const nextData = {
          transactionId,
          clientProfileId: link.transaction.clientProfileId,
          requirementId: document.requirementId ?? null,
          label: requirement?.label || document.label || "Uploaded Document",
          type: document.type,
          assetUrl: document.type === "TEXT" ? null : document.secure_url!,
          textValue: document.type === "TEXT" ? document.textValue : null,
          publicId: document.type === "TEXT" ? null : document.public_id!,
          fileName: document.type === "TEXT" ? null : document.original_filename || null,
        }

        if (document.requirementId) {
          const existingDocument = existingDocumentsByRequirementId.get(document.requirementId)

          if (
            existingDocument &&
            document.type !== "TEXT" &&
            (existingDocument.publicId !== nextData.publicId || existingDocument.assetUrl !== nextData.assetUrl)
          ) {
            assetsToCleanup.push({
              publicId: existingDocument.publicId,
              assetUrl: existingDocument.assetUrl,
              fileName: existingDocument.fileName,
            })
          }

          await tx.documentAsset.upsert({
            where: {
              transactionId_requirementId: {
                transactionId,
                requirementId: document.requirementId,
              },
            },
            update: nextData,
            create: nextData,
          })

          continue
        }

        await tx.documentAsset.create({ data: nextData })
      }

      if (documentsToDelete.length > 0) {
        await tx.documentAsset.deleteMany({
          where: {
            id: {
              in: documentsToDelete.map((document) => document.id),
            },
          },
        })

        for (const document of documentsToDelete) {
          if (document.publicId || document.assetUrl) {
            assetsToCleanup.push({
              publicId: document.publicId,
              assetUrl: document.assetUrl,
              fileName: document.fileName,
            })
          }
        }
      }

      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "DOCS_SUBMITTED" },
      })

      await recordTransactionEvent(tx, {
        transactionId,
        type: "DOCUMENTS_SUBMITTED",
        title: "Client requirements submitted",
        detail: `${validatedDocuments.length} required item(s) were submitted.`,
        dedupeKey: `event:documents:${transactionId}`,
      })
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

    if (assetsToCleanup.length > 0) {
      await Promise.allSettled(
        assetsToCleanup.map((asset) =>
          destroyDocumentCloudinaryAssetIfUnreferenced({
            publicId: asset.publicId,
            assetUrl: asset.assetUrl,
            fileName: asset.fileName,
          })
        )
      )
    }

    return NextResponse.json({ success: true, nextStep })
  } catch (error) {
    console.error("Save Documents Error:", error)
    return NextResponse.json({ success: false, message: "Failed to save documents" }, { status: 500 })
  }
}
