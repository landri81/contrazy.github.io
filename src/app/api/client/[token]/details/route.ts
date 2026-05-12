import { NextResponse } from "next/server"

import { invalidateTransactionAgreementState } from "@/features/contracts/server/contract-artifacts"
import { clientCustomFieldResponsesSchema } from "@/features/client-flow/schemas/client-custom-fields.schema"
import {
  canRevisitClientStep,
  clientFlowTransactionInclude,
  getNextClientStep,
} from "@/features/client-flow/server/client-flow-data"
import { completeTransactionWithoutPayment } from "@/features/transactions/server/transaction-finance"
import { parseTransactionCustomFieldSelectOptions } from "@/features/transactions/custom-fields"
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
      return NextResponse.json(
        { success: false, message: "This secure link is no longer available." },
        { status: 410 }
      )
    }

    const body = await request.json()
    const parsedBody = clientCustomFieldResponsesSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            parsedBody.error.issues[0]?.message ?? "Invalid customer field response data.",
        },
        { status: 400 }
      )
    }

    const { link } = linkContext
    const transactionId = link.transaction.id
    const currentTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: clientFlowTransactionInclude,
    })

    if (!currentTransaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    if (!canRevisitClientStep(currentTransaction, "details")) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer details can no longer be changed after payment has started.",
        },
        { status: 409 }
      )
    }

    if (currentTransaction.customFields.length === 0) {
      return NextResponse.json({
        success: true,
        nextStep: getNextClientStep(currentTransaction),
      })
    }

    const responseMap = new Map<string, string>()
    const validFieldIds = new Set(currentTransaction.customFields.map((field) => field.id))

    for (const response of parsedBody.data.responses) {
      if (responseMap.has(response.customFieldId)) {
        return NextResponse.json(
          { success: false, message: "Duplicate customer field responses were submitted." },
          { status: 400 }
        )
      }

      if (!validFieldIds.has(response.customFieldId)) {
        return NextResponse.json(
          { success: false, message: "A requested customer field could not be found." },
          { status: 400 }
        )
      }

      responseMap.set(response.customFieldId, response.value.trim())
    }

    for (const field of currentTransaction.customFields) {
      const value = responseMap.get(field.id)?.trim() ?? ""

      if (!value) {
        return NextResponse.json(
          {
            success: false,
            message: `Complete the required field "${field.label}" before continuing.`,
          },
          { status: 400 }
        )
      }

      if (field.type === "NUMBER" && !Number.isFinite(Number(value))) {
        return NextResponse.json(
          {
            success: false,
            message: `Enter a valid number for "${field.label}".`,
          },
          { status: 400 }
        )
      }

      if (field.type === "SELECT") {
        const options = parseTransactionCustomFieldSelectOptions(field.selectOptions)

        if (!options.includes(value)) {
          return NextResponse.json(
            {
              success: false,
              message: `Choose one of the available options for "${field.label}".`,
            },
            { status: 400 }
          )
        }
      }
    }

    await markTransactionLinkOpened(prisma, { linkId: link.id, transactionId })

    const hasChangedResponse = currentTransaction.customFields.some((field) => {
      const previousValue = field.response?.value?.trim() ?? ""
      const nextValue = responseMap.get(field.id)?.trim() ?? ""

      return previousValue !== nextValue
    })

    const hadAgreementProgress = Boolean(
      currentTransaction.contractArtifact?.reviewCompletedAt ||
        currentTransaction.contractArtifact?.signedPdfUrl ||
        currentTransaction.signatureRecord?.signatureDataUrl
    )

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        currentTransaction.customFields.map((field) =>
          tx.transactionCustomFieldResponse.upsert({
            where: { customFieldId: field.id },
            update: {
              value: responseMap.get(field.id) as string,
              answeredAt: new Date(),
            },
            create: {
              transactionId,
              customFieldId: field.id,
              value: responseMap.get(field.id) as string,
            },
          })
        )
      )

      if (hadAgreementProgress && hasChangedResponse) {
        await invalidateTransactionAgreementState(tx, transactionId)

        await recordTransactionEvent(tx, {
          transactionId,
          type: "LINK_UPDATED",
          title: "Agreement reopened after customer detail update",
          detail:
            "Customer-provided agreement details changed, so the agreement must be reviewed and signed again before payment.",
          dedupeKey: `event:custom-field-agreement-reopened:${transactionId}:${Date.now()}`,
        })
      }

      await recordTransactionEvent(tx, {
        transactionId,
        type: "CUSTOM_FIELDS_SUBMITTED",
        title: "Customer details submitted",
        detail: `${currentTransaction.customFields.length} customer field(s) were completed before contract review.`,
        dedupeKey: `event:custom-fields:${transactionId}`,
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

    return NextResponse.json({ success: true, nextStep })
  } catch (error) {
    console.error("Save Customer Details Error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to save customer details" },
      { status: 500 }
    )
  }
}
