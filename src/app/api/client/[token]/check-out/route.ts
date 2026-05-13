import { NextResponse } from "next/server"
import { TransactionReportStatus, TransactionReportType } from "@prisma/client"
import { z } from "zod"

import {
  clientFlowTransactionInclude,
  getNextClientStep,
  hasSubmittedCheckOut,
  isCheckInOutFlow,
} from "@/features/client-flow/server/client-flow-data"
import { generateReportArtifactHtml } from "@/features/transactions/server/report-artifacts"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { parseTransactionCustomFieldSelectOptions } from "@/features/transactions/custom-fields"
import { prisma } from "@/lib/db/prisma"

const checkOutBodySchema = z.object({
  responses: z.array(
    z.object({
      fieldId: z.string().min(1),
      value: z.string(),
    })
  ),
  photos: z.array(
    z.object({
      assetUrl: z.string().url(),
      publicId: z.string().min(1),
      fileName: z.string().min(1),
      sortOrder: z.number().int().optional().default(0),
    })
  ),
})

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

    const body = await request.json().catch(() => null)
    const parsed = checkOutBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid request data." },
        { status: 400 }
      )
    }

    const transactionId = linkContext.link.transaction.id

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: clientFlowTransactionInclude,
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    if (!isCheckInOutFlow(transaction)) {
      return NextResponse.json({ success: false, message: "This transaction does not support check-out." }, { status: 409 })
    }

    if (!transaction.checkOutRequestedAt) {
      return NextResponse.json({ success: false, message: "Checkout has not been requested yet." }, { status: 409 })
    }

    if (hasSubmittedCheckOut(transaction)) {
      return NextResponse.json({ success: false, message: "Check-out has already been submitted." }, { status: 409 })
    }

    const { responses, photos } = parsed.data

    if (photos.length === 0) {
      return NextResponse.json({ success: false, message: "At least one photo is required." }, { status: 400 })
    }

    const checkOutFields = transaction.reportFields.filter(
      (f) => f.reportType === TransactionReportType.CHECK_OUT
    )

    const responseMap = new Map<string, string>()
    for (const r of responses) {
      responseMap.set(r.fieldId, r.value.trim())
    }

    for (const field of checkOutFields) {
      const value = responseMap.get(field.id) ?? ""
      if (!value) {
        return NextResponse.json(
          { success: false, message: `"${field.label}" is required.` },
          { status: 400 }
        )
      }
      if (field.fieldType === "NUMBER" && !Number.isFinite(Number(value))) {
        return NextResponse.json(
          { success: false, message: `"${field.label}" must be a valid number.` },
          { status: 400 }
        )
      }
      if (field.fieldType === "SELECT") {
        const opts = parseTransactionCustomFieldSelectOptions(field.selectOptions)
        if (!opts.includes(value)) {
          return NextResponse.json(
            { success: false, message: `Choose a valid option for "${field.label}".` },
            { status: 400 }
          )
        }
      }
    }

    const submittedAt = new Date()

    // Build comparison fields from check-in report
    const checkInReport = transaction.reports.find(
      (r) => r.type === TransactionReportType.CHECK_IN
    )
    const checkInFields = transaction.reportFields.filter(
      (f) => f.reportType === TransactionReportType.CHECK_IN
    )
    const checkInResponseMap = new Map(
      (checkInReport?.responses ?? []).map((r) => [r.fieldId, r.value])
    )

    const comparisonFields = checkOutFields.flatMap((f) => {
      const matchingCheckIn = checkInFields.find((ci) => ci.label === f.label)
      if (!matchingCheckIn) return []
      const priorValue = checkInResponseMap.get(matchingCheckIn.id)
      if (!priorValue) return []
      return [{ label: f.label, priorValue, currentValue: responseMap.get(f.id) ?? "" }]
    })

    const artifactHtml = generateReportArtifactHtml({
      reportType: TransactionReportType.CHECK_OUT,
      transactionReference: transaction.reference,
      vendorName: transaction.vendor?.businessName ?? null,
      clientName: transaction.clientProfile?.fullName ?? null,
      submittedAt,
      fields: checkOutFields.map((f) => ({
        label: f.label,
        value: responseMap.get(f.id) ?? "",
      })),
      assets: photos.map((p) => ({ assetUrl: p.assetUrl, fileName: p.fileName })),
      comparisonFields,
    })

    await prisma.$transaction(async (tx) => {
      const report = await tx.transactionReport.upsert({
        where: {
          transactionId_type: {
            transactionId,
            type: TransactionReportType.CHECK_OUT,
          },
        },
        update: {
          status: TransactionReportStatus.SUBMITTED,
          submittedAt,
          artifactHtml,
        },
        create: {
          transactionId,
          type: TransactionReportType.CHECK_OUT,
          status: TransactionReportStatus.SUBMITTED,
          submittedAt,
          artifactHtml,
        },
      })

      for (const field of checkOutFields) {
        await tx.transactionReportResponse.upsert({
          where: { reportId_fieldId: { reportId: report.id, fieldId: field.id } },
          update: { value: responseMap.get(field.id) ?? "" },
          create: {
            reportId: report.id,
            fieldId: field.id,
            value: responseMap.get(field.id) ?? "",
          },
        })
      }

      await tx.transactionReportAsset.deleteMany({ where: { reportId: report.id } })
      if (photos.length > 0) {
        await tx.transactionReportAsset.createMany({
          data: photos.map((p) => ({
            reportId: report.id,
            assetUrl: p.assetUrl,
            publicId: p.publicId,
            fileName: p.fileName,
            sortOrder: p.sortOrder,
          })),
        })
      }

      await recordTransactionEvent(tx, {
        transactionId,
        type: "CHECK_OUT_SUBMITTED",
        title: "Check-out report submitted",
        detail: `${checkOutFields.length} field(s) and ${photos.length} photo(s) recorded.`,
        dedupeKey: `event:check-out-submitted:${transactionId}`,
        occurredAt: submittedAt,
      })
    })

    const updatedTransaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: clientFlowTransactionInclude,
    })

    if (!updatedTransaction) {
      return NextResponse.json({ success: false, message: "Transaction not found" }, { status: 404 })
    }

    const nextStep = getNextClientStep(updatedTransaction)
    return NextResponse.json({ success: true, nextStep })
  } catch (error) {
    console.error("Check-Out Submit Error:", error)
    return NextResponse.json({ success: false, message: "Failed to submit check-out report." }, { status: 500 })
  }
}
