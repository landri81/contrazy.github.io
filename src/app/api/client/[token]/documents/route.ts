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

    const requirements = await prisma.transactionRequirement.findMany({
      where: { transactionId },
    })
    const requirementsById = new Map(requirements.map((requirement) => [requirement.id, requirement]))

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

      if (resolvedType === "TEXT" && !trimmedTextValue) {
        return NextResponse.json({ success: false, message: "Complete every required text field before continuing." }, { status: 400 })
      }

      if (resolvedType !== "TEXT" && (!document.secure_url || !document.public_id)) {
        return NextResponse.json({ success: false, message: "Upload every required file before continuing." }, { status: 400 })
      }

      const nextData = {
        transactionId,
        clientProfileId: link.transaction.clientProfileId,
        requirementId: document.requirementId ?? null,
        label: requirement?.label || document.label || "Uploaded Document",
        type: resolvedType,
        assetUrl: resolvedType === "TEXT" ? null : document.secure_url!,
        textValue: resolvedType === "TEXT" ? trimmedTextValue : null,
        publicId: resolvedType === "TEXT" ? null : document.public_id!,
        fileName: resolvedType === "TEXT" ? null : document.original_filename || null,
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
      title: "Client requirements submitted",
      detail: `${documents.length} required item(s) were submitted.`,
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
