import { randomBytes } from "crypto"

import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { StripeConnectionStatus, TransactionLinkStatus } from "@prisma/client"

import { canUseKyc, remainingKycVerifications, remainingQrCodes, remainingTransactions } from "@/features/subscriptions/server/feature-gates"
import { incrementVendorSubscriptionUsage } from "@/features/subscriptions/server/subscription-usage"
import { buildVendorActionsUsage, buildVendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
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
        clientEmail: transaction.clientProfile?.email ?? "No email",
        kind: transaction.kind,
        amount: transaction.amount,
        depositAmount: transaction.depositAmount,
        currency: transaction.currency,
        requiresKyc: transaction.requiresKyc,
        kycStatus: transaction.kycVerification?.status ?? null,
        signatureStatus: transaction.signatureRecord?.status ?? null,
        status: transaction.status,
        shortCode: transaction.link?.shortCode ?? null,
        shareLink: transaction.link?.token ? `${getAppBaseUrl()}/t/${transaction.link.token}` : null,
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
    const {
      title,
      notes,
      contractTemplateId,
      checklistTemplateId,
      amount,
      depositAmount,
      requiresKyc,
      generateQr,
    } = body

    if (!title) {
      return NextResponse.json({ success: false, message: "Title is required" }, { status: 400 })
    }

    const normalizedAmount = typeof amount === "number" ? amount : null
    const normalizedDepositAmount = typeof depositAmount === "number" ? depositAmount : null

    if (normalizedAmount !== null && (!Number.isInteger(normalizedAmount) || normalizedAmount < 0)) {
      return NextResponse.json({ success: false, message: "Service payment amount must be a positive whole-cent value" }, { status: 422 })
    }

    if (normalizedDepositAmount !== null && (!Number.isInteger(normalizedDepositAmount) || normalizedDepositAmount < 0)) {
      return NextResponse.json({ success: false, message: "Deposit amount must be a positive whole-cent value" }, { status: 422 })
    }

    if (normalizedAmount === 0 || normalizedDepositAmount === 0) {
      return NextResponse.json({ success: false, message: "Amounts must be greater than zero when provided" }, { status: 422 })
    }

    if (normalizedAmount === null && normalizedDepositAmount === null && requiresKyc) {
      return NextResponse.json(
        { success: false, message: "Identity verification requires a connected Stripe account and a live transaction setup." },
        { status: 422 }
      )
    }

    const needsStripe = Boolean(normalizedAmount || normalizedDepositAmount || requiresKyc)

    if ((remainingTransactions(subscription) ?? 1) <= 0) {
      return NextResponse.json(
        { success: false, message: "Your current plan has reached its monthly transaction limit." },
        { status: 422 }
      )
    }

    if (generateQr === true && (remainingQrCodes(subscription) ?? 1) <= 0) {
      return NextResponse.json(
        { success: false, message: "Your current plan has reached its monthly QR code limit. Upgrade to create more." },
        { status: 422 }
      )
    }

    if (requiresKyc) {
      if (!canUseKyc(subscription)) {
        return NextResponse.json(
          { success: false, message: "Identity verification is not available on your current plan." },
          { status: 422 }
        )
      }

      const remainingKyc = remainingKycVerifications(subscription)

      if (remainingKyc !== null && remainingKyc <= 0) {
        return NextResponse.json(
          { success: false, message: "Your included KYC verification quota has been reached for this billing period." },
          { status: 422 }
        )
      }
    }

    if (
      needsStripe &&
      (vendorProfile.stripeConnectionStatus !== StripeConnectionStatus.CONNECTED || !vendorProfile.stripeAccountId)
    ) {
      return NextResponse.json(
        { success: false, message: "Connect Stripe before enabling payments, deposit holds, or identity verification." },
        { status: 422 }
      )
    }

    const [contractTemplate, checklistTemplate] = await Promise.all([
      contractTemplateId
        ? prisma.contractTemplate.findFirst({
            where: { id: contractTemplateId, vendorId: vendorProfile.id },
          })
        : Promise.resolve(null),
      checklistTemplateId
        ? prisma.checklistTemplate.findFirst({
            where: { id: checklistTemplateId, vendorId: vendorProfile.id },
            include: { items: true },
          })
        : Promise.resolve(null),
    ])

    if (contractTemplateId && !contractTemplate) {
      return NextResponse.json({ success: false, message: "Selected contract template was not found for this account" }, { status: 422 })
    }

    if (checklistTemplateId && !checklistTemplate) {
      return NextResponse.json({ success: false, message: "Selected checklist was not found for this account" }, { status: 422 })
    }

    const reference = `TX-${randomBytes(4).toString("hex").toUpperCase()}`
    const token = randomBytes(16).toString("hex")
    const baseUrl = getAppBaseUrl()
    const secureLink = `${baseUrl}/t/${token}`
    const qrCodeSvg =
      generateQr === true
        ? await QRCode.toString(secureLink, { type: "svg", margin: 1 })
        : null

    // A financial amount is mandatory
    if (!normalizedAmount && !normalizedDepositAmount) {
      return NextResponse.json(
        { success: false, message: "A service payment amount or deposit hold amount is required." },
        { status: 422 }
      )
    }

    let kind: "PAYMENT" | "DEPOSIT" | "HYBRID"
    if (normalizedAmount && normalizedDepositAmount) kind = "HYBRID"
    else if (normalizedDepositAmount) kind = "DEPOSIT"
    else kind = "PAYMENT" // covers service-payment-only and doc-only flows

    const transaction = await prisma.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          vendorId: vendorProfile.id,
          reference,
          title,
          notes,
          kind,
          amount: normalizedAmount,
          depositAmount: normalizedDepositAmount,
          requiresKyc: Boolean(requiresKyc),
          contractTemplateId: contractTemplate?.id ?? null,
          checklistTemplateId: checklistTemplate?.id ?? null,
          status: "LINK_SENT",
        },
      })

      const link = await tx.transactionLink.create({
        data: {
          transactionId: newTransaction.id,
          token,
          shortCode: randomBytes(3).toString("hex").toUpperCase(),
          qrCodeSvg,
          status: TransactionLinkStatus.ACTIVE,
        },
      })

      if (checklistTemplate?.items.length) {
          await tx.transactionRequirement.createMany({
            data: checklistTemplate.items.map((item) => ({
              transactionId: newTransaction.id,
              label: item.label,
              instructions: item.description,
              type: item.type,
              required: item.required,
            })),
          })
      }

      await recordTransactionEvent(tx, {
        transactionId: newTransaction.id,
        type: "LINK_CREATED",
        title: "Secure link created",
        detail: "The customer workflow is ready to be shared.",
        dedupeKey: `event:link-created:${newTransaction.id}`,
      })

      await incrementVendorSubscriptionUsage(tx, vendorProfile.id, "transactionsUsed")
      if (generateQr === true) {
        await incrementVendorSubscriptionUsage(tx, vendorProfile.id, "qrCodesUsed")
      }

      const updatedSubscription = await tx.vendorSubscription.findUnique({
        where: { vendorId: vendorProfile.id },
      })

      return { ...newTransaction, link, updatedSubscription }
    })

    const { updatedSubscription, ...transactionPayload } = transaction

    return NextResponse.json(
      {
        ...transactionPayload,
        linkRecord: buildVendorLinkRecord({
          id: transactionPayload.id,
          reference: transactionPayload.reference,
          title: transactionPayload.title,
          kind: transactionPayload.kind,
          amount: transactionPayload.amount,
          depositAmount: transactionPayload.depositAmount,
          currency: transactionPayload.currency,
          notes: transactionPayload.notes,
          updatedAt: transactionPayload.updatedAt,
          clientProfile: null,
          link: transactionPayload.link,
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
