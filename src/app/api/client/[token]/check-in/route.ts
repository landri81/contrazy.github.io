import { NextResponse } from "next/server"
import { TransactionReportStatus, TransactionReportType } from "@prisma/client"
import { z } from "zod"

import {
  clientFlowTransactionInclude,
  getNextClientStep,
  hasCheckInStep,
  hasSubmittedCheckIn,
  isCheckInOutFlow,
} from "@/features/client-flow/server/client-flow-data"
import { generateReportArtifactHtml } from "@/features/transactions/server/report-artifacts"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"
import { parseTransactionCustomFieldSelectOptions } from "@/features/transactions/custom-fields"
import { prisma } from "@/lib/db/prisma"

const checkInBodySchema = z.object({
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
    const parsed = checkInBodySchema.safeParse(body)

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
      return NextResponse.json({ success: false, message: "This transaction does not support check-in." }, { status: 409 })
    }

    if (!hasCheckInStep(transaction)) {
      return NextResponse.json({ success: false, message: "No check-in fields configured." }, { status: 409 })
    }

    if (hasSubmittedCheckIn(transaction)) {
      return NextResponse.json({ success: false, message: "Check-in has already been submitted." }, { status: 409 })
    }

    const { responses, photos } = parsed.data

    if (photos.length === 0) {
      return NextResponse.json({ success: false, message: "At least one photo is required." }, { status: 400 })
    }

    const checkInFields = transaction.reportFields.filter(
      (f) => f.reportType === TransactionReportType.CHECK_IN
    )

    const responseMap = new Map<string, string>()
    for (const r of responses) {
      responseMap.set(r.fieldId, r.value.trim())
    }

    for (const field of checkInFields) {
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

    const artifactHtml = generateReportArtifactHtml({
      reportType: TransactionReportType.CHECK_IN,
      transactionReference: transaction.reference,
      vendorName: transaction.vendor?.businessName ?? null,
      clientName: transaction.clientProfile?.fullName ?? null,
      submittedAt,
      fields: checkInFields.map((f) => ({
        label: f.label,
        value: responseMap.get(f.id) ?? "",
      })),
      assets: photos.map((p) => ({ assetUrl: p.assetUrl, fileName: p.fileName })),
    })

    await prisma.$transaction(async (tx) => {
      // Upsert the check-in report record
      const report = await tx.transactionReport.upsert({
        where: {
          transactionId_type: {
            transactionId,
            type: TransactionReportType.CHECK_IN,
          },
        },
        update: {
          status: TransactionReportStatus.SUBMITTED,
          submittedAt,
          artifactHtml,
        },
        create: {
          transactionId,
          type: TransactionReportType.CHECK_IN,
          status: TransactionReportStatus.SUBMITTED,
          submittedAt,
          artifactHtml,
        },
      })

      // Save field responses
      for (const field of checkInFields) {
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

      // Delete and re-save assets for idempotency
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
        type: "CHECK_IN_SUBMITTED",
        title: "Check-in report submitted",
        detail: `${checkInFields.length} field(s) and ${photos.length} photo(s) recorded.`,
        dedupeKey: `event:check-in-submitted:${transactionId}`,
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
    console.error("Check-In Submit Error:", error)
    return NextResponse.json({ success: false, message: "Failed to submit check-in report." }, { status: 500 })
  }
}
