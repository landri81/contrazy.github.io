import { NextResponse } from "next/server"

import { remainingQrCodes } from "@/features/subscriptions/server/feature-gates"
import { incrementVendorSubscriptionUsageFields } from "@/features/subscriptions/server/subscription-usage"
import { vendorTransactionCreateSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { buildVendorActionsUsage, buildVendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import {
  createPreparedVendorTransaction,
  formatVendorTransactionParseError,
  prepareVendorTransactionLaunch,
} from "@/features/transactions/server/vendor-transaction-launch"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination"

export async function GET(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const { searchParams } = new URL(request.url)
    const pagination = resolvePagination(
      { page: searchParams.get("page"), pageSize: searchParams.get("pageSize") },
      { defaultPageSize: 20, maxPageSize: 100 }
    )

    const [items, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: { vendorId: vendorProfile.id },
        include: {
          clientProfile: { select: { fullName: true, email: true } },
          bulkRecipient: { select: { email: true } },
          kycVerification: { select: { status: true } },
          signatureRecord: { select: { status: true } },
          link: { select: { token: true, shortCode: true, qrCodeSvg: true, openedAt: true, completedAt: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      prisma.transaction.count({ where: { vendorId: vendorProfile.id } }),
    ])

    return NextResponse.json({
      items: items.map((transaction) => ({
        id: transaction.id,
        reference: transaction.reference,
        title: transaction.title,
        clientName: transaction.clientProfile?.fullName ?? "Client pending",
        clientEmail: transaction.clientProfile?.email ?? transaction.bulkRecipient?.email ?? "No email",
        kind: transaction.kind,
        amount: transaction.amount,
        depositAmount: transaction.depositAmount,
        currency: transaction.currency,
        requiresKyc: transaction.requiresKyc,
        kycStatus: transaction.kycVerification?.status ?? null,
        signatureStatus: transaction.signatureRecord?.status ?? null,
        status: transaction.status,
        shortCode: transaction.link?.shortCode ?? null,
        shareLink: transaction.link?.token ? `${getAppBaseUrl()}/${transaction.locale.toLowerCase()}/t/${transaction.link.token}` : null,
        qrReady: Boolean(transaction.link?.qrCodeSvg),
        createdAt: transaction.createdAt,
      })),
      ...buildPaginationMeta(totalCount, pagination.page, pagination.pageSize),
    })
  } catch (error) {
    console.error("List Transactions Error:", error)
    return NextResponse.json({ success: false, message: "Failed to load transactions" }, { status: 500 })
  }
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
    const parsedBody = vendorTransactionCreateSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          success: false,
          message: formatVendorTransactionParseError(parsedBody.error),
        },
        { status: 400 }
      )
    }

    const launch = await prepareVendorTransactionLaunch({
      request,
      vendorProfile,
      subscription,
      data: parsedBody.data,
    })

    if (!launch.ok) {
      return launch.response
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const createdTransaction = await createPreparedVendorTransaction(tx, launch.prepared, {
        vendorId: vendorProfile.id,
      })
      await incrementVendorSubscriptionUsageFields(tx, vendorProfile.id, {
        transactionsUsed: 1,
        qrCodesUsed: launch.prepared.generateQr === true ? 1 : 0,
      })

      return createdTransaction
    }, {
      maxWait: 10_000,
      timeout: 15_000,
    })

    const updatedSubscription = await prisma.vendorSubscription.findUnique({
      where: { vendorId: vendorProfile.id },
    })

    return NextResponse.json(
      {
        ...transaction,
        linkRecord: buildVendorLinkRecord({
          id: transaction.id,
          reference: transaction.reference,
          title: transaction.title,
          kind: transaction.kind,
          amount: transaction.amount,
          depositAmount: transaction.depositAmount,
          currency: transaction.currency,
          locale: transaction.locale,
          notes: transaction.notes,
          updatedAt: transaction.updatedAt,
          clientProfile: transaction.clientProfile,
          link: transaction.link,
        }, { qrRemaining: remainingQrCodes(updatedSubscription) }),
        actionUsage: buildVendorActionsUsage(updatedSubscription),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Create Transaction Error:", error)
    return NextResponse.json({ success: false, message: "Failed to create transaction" }, { status: 500 })
  }
}
