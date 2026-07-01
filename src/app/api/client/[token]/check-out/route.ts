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
  fieldAssets: z.array(
    z.object({
      fieldId: z.string().min(1),
      assets: z.array(
        z.object({
          assetUrl: z.string().url(),
          publicId: z.string().min(1),
          fileName: z.string().min(1),
          mimeType: z.string().trim().min(1).nullable().optional(),
          sortOrder: z.number().int().optional().default(0),
        })
      ),
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

    const { responses, fieldAssets } = parsed.data

    const checkOutFields = transaction.reportFields.filter(
      (f) => f.reportType === TransactionReportType.CHECK_OUT
    )

    const responseMap = new Map<string, string>()
    for (const r of responses) {
      responseMap.set(r.fieldId, r.value.trim())
    }

    const assetMap = new Map<
      string,
      Array<{
        assetUrl: string
        publicId: string
        fileName: string
        mimeType: string | null
        sortOrder: number
      }>
    >()

    for (const entry of fieldAssets) {
      assetMap.set(
        entry.fieldId,
        [...entry.assets]
          .map((asset) => ({
            ...asset,
            mimeType: asset.mimeType ?? null,
          }))
          .sort((left, right) => left.sortOrder - right.sortOrder)
      )
    }

    for (const field of checkOutFields) {
      const value = responseMap.get(field.id) ?? ""
      const assets = assetMap.get(field.id) ?? []

      if (field.fieldType === "PHOTO" || field.fieldType === "FILE") {
        if (assets.length === 0) {
          return NextResponse.json(
            {
              success: false,
              message:
                field.fieldType === "PHOTO"
                  ? `Upload at least one photo for "${field.label}".`
                  : `Upload at least one file for "${field.label}".`,
            },
            { status: 400 }
          )
        }

        if (
          field.fieldType === "PHOTO" &&
          assets.some((asset) => asset.mimeType && !asset.mimeType.startsWith("image/"))
        ) {
          return NextResponse.json(
            { success: false, message: `"${field.label}" only accepts image uploads.` },
            { status: 400 }
          )
        }

        continue
      }

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
    const flattenedAssets = checkOutFields.flatMap((field) =>
      (assetMap.get(field.id) ?? []).map((asset, index) => ({
        fieldId: field.id,
        assetUrl: asset.assetUrl,
        publicId: asset.publicId,
        fileName: asset.fileName,
        mimeType: asset.mimeType ?? null,
        sortOrder: asset.sortOrder ?? index,
      }))
    )

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

    const artifactHtml = generateReportArtifactHtml({
      reportType: TransactionReportType.CHECK_OUT,
      transactionReference: transaction.reference,
      vendorName: transaction.vendor?.businessName ?? null,
      clientName: transaction.clientProfile?.fullName ?? null,
      submittedAt,
      fields: checkOutFields.map((f) => ({
        label: f.label,
        type: f.fieldType,
        value: responseMap.get(f.id) ?? "",
        priorValue: (() => {
          if (f.fieldType === "PHOTO" || f.fieldType === "FILE") {
            return null
          }
          const matchingCheckIn = checkInFields.find((field) => field.label === f.label)
          return matchingCheckIn ? (checkInResponseMap.get(matchingCheckIn.id) ?? null) : null
        })(),
        assets: (assetMap.get(f.id) ?? []).map((asset) => ({
          assetUrl: asset.assetUrl,
          fileName: asset.fileName,
          mimeType: asset.mimeType ?? null,
        })),
      })),
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
      if (flattenedAssets.length > 0) {
        await tx.transactionReportAsset.createMany({
          data: flattenedAssets.map((asset) => ({
            reportId: report.id,
            fieldId: asset.fieldId,
            assetUrl: asset.assetUrl,
            publicId: asset.publicId,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            sortOrder: asset.sortOrder,
          })),
        })
      }

      await recordTransactionEvent(tx, {
        transactionId,
        type: "CHECK_OUT_SUBMITTED",
        title: "Check-out report submitted",
        detail: `${checkOutFields.length} field(s) and ${flattenedAssets.length} upload(s) recorded.`,
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
