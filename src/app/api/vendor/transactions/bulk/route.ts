import { NextResponse } from "next/server"
import { BulkShareBatchStatus, BulkShareRecipientStatus, type Prisma } from "@prisma/client"

import { vendorBulkTransactionCreateSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { buildVendorActionsUsage } from "@/features/dashboard/server/dashboard-data"
import { incrementVendorSubscriptionUsageFields } from "@/features/subscriptions/server/subscription-usage"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import {
  createPreparedVendorTransaction,
  formatVendorTransactionParseError,
  prepareVendorTransactionLaunch,
} from "@/features/transactions/server/vendor-transaction-launch"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { sendBulkTransactionLinkEmail } from "@/lib/integrations/resend"

export const runtime = "nodejs"
export const maxDuration = 60

type BulkCreatedRow = {
  recipientId: string
  transactionId: string
  email: string
  reference: string
  secureLink: string
}

function buildConfigSnapshot(data: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue
}

function getBatchStatus(sentCount: number, failedCount: number) {
  if (failedCount === 0) {
    return BulkShareBatchStatus.COMPLETED
  }

  if (sentCount === 0) {
    return BulkShareBatchStatus.FAILED
  }

  return BulkShareBatchStatus.PARTIAL
}

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response, subscription } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response || !subscription) {
      return response ?? NextResponse.json({ success: false, message: "Subscription required." }, { status: 402 })
    }

    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const body = await request.json()
    const parsedBody = vendorBulkTransactionCreateSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatVendorTransactionParseError(parsedBody.error),
        },
        { status: 400 }
      )
    }

    const recipientEmails = parsedBody.data.recipientEmails

    if (recipientEmails.length > 100) {
      return NextResponse.json(
        { success: false, message: "Bulk CSV sharing supports up to 100 recipients at a time." },
        { status: 422 }
      )
    }

    const launch = await prepareVendorTransactionLaunch({
      request,
      vendorProfile,
      subscription,
      data: parsedBody.data,
      recipientCount: recipientEmails.length,
      forceGenerateQr: false,
      allowRecreate: false,
    })

    if (!launch.ok) {
      return launch.response
    }

    const created = await prisma.$transaction(
      async (tx) => {
        const batch = await tx.bulkShareBatch.create({
          data: {
            vendorId: vendorProfile.id,
            sourceFileName: parsedBody.data.sourceFileName,
            recipientCount: recipientEmails.length,
            configSnapshot: buildConfigSnapshot({
              ...parsedBody.data,
              recipientEmails: undefined,
              sourceFileName: parsedBody.data.sourceFileName,
            }),
            status: BulkShareBatchStatus.CREATING,
          },
        })

        const rows: BulkCreatedRow[] = []

        for (const email of recipientEmails) {
          const transaction = await createPreparedVendorTransaction(tx, launch.prepared, {
            vendorId: vendorProfile.id,
            bulkBatchId: batch.id,
            cloneRecreateSource: false,
          })

          const recipient = await tx.bulkShareRecipient.create({
            data: {
              batchId: batch.id,
              transactionId: transaction.id,
              email,
              normalizedEmail: email,
              status: BulkShareRecipientStatus.PENDING,
            },
          })

          rows.push({
            recipientId: recipient.id,
            transactionId: transaction.id,
            email,
            reference: transaction.reference,
            secureLink: transaction.secureLink,
          })
        }

        await incrementVendorSubscriptionUsageFields(tx, vendorProfile.id, {
          transactionsUsed: recipientEmails.length,
        })

        return { batch, rows }
      },
      {
        maxWait: 10_000,
        timeout: 60_000,
      }
    )

    let sentCount = 0
    let failedCount = 0
    const vendorName = vendorProfile.businessName || vendorProfile.businessEmail || "Contrazy vendor"
    const deliveryRows = []

    for (const row of created.rows) {
      const sent = await sendBulkTransactionLinkEmail(
        row.email,
        vendorName,
        launch.prepared.title,
        row.reference,
        row.secureLink,
        launch.prepared.locale
      )

      if (sent) {
        sentCount += 1
        await prisma.$transaction(async (tx) => {
          await tx.bulkShareRecipient.update({
            where: { id: row.recipientId },
            data: {
              status: BulkShareRecipientStatus.EMAIL_SENT,
              sentAt: new Date(),
              errorMessage: null,
            },
          })

          await recordTransactionEvent(tx, {
            transactionId: row.transactionId,
            type: "EMAIL_SENT",
            title: "Bulk secure link email sent",
            detail: `Secure link emailed to ${row.email}.`,
            dedupeKey: `event:bulk-email-sent:${row.transactionId}:${row.email}`,
            metadata: {
              batchId: created.batch.id,
              recipientEmail: row.email,
            },
          })
        })
      } else {
        failedCount += 1
        await prisma.bulkShareRecipient.update({
          where: { id: row.recipientId },
          data: {
            status: BulkShareRecipientStatus.EMAIL_FAILED,
            errorMessage: "Email provider did not accept the message.",
          },
        })
      }

      deliveryRows.push({
        email: row.email,
        reference: row.reference,
        transactionId: row.transactionId,
        secureLink: row.secureLink,
        deliveryStatus: sent ? BulkShareRecipientStatus.EMAIL_SENT : BulkShareRecipientStatus.EMAIL_FAILED,
      })
    }

    const batchStatus = getBatchStatus(sentCount, failedCount)
    const [batch, updatedSubscription] = await Promise.all([
      prisma.bulkShareBatch.update({
        where: { id: created.batch.id },
        data: {
          status: batchStatus,
          sentCount,
          failedCount,
          completedAt: new Date(),
        },
      }),
      prisma.vendorSubscription.findUnique({
        where: { vendorId: vendorProfile.id },
      }),
    ])

    return NextResponse.json(
      {
        success: true,
        batch: {
          id: batch.id,
          status: batch.status,
          recipientCount: batch.recipientCount,
          sentCount: batch.sentCount,
          failedCount: batch.failedCount,
        },
        rows: deliveryRows,
        actionUsage: buildVendorActionsUsage(updatedSubscription),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Bulk Transaction Create Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create bulk transactions" }, { status: 500 })
  }
}
