import { randomBytes } from "crypto"

import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { Prisma, StripeConnectionStatus, TransactionLinkStatus } from "@prisma/client"

import { canUseKyc, remainingKycVerifications, remainingQrCodes, remainingTransactions } from "@/features/subscriptions/server/feature-gates"
import { incrementVendorSubscriptionUsageFields } from "@/features/subscriptions/server/subscription-usage"
import { vendorTransactionCreateSchema } from "@/features/dashboard/schemas/vendor-operations.schema"
import { normalizeRequirementExampleImage } from "@/features/dashboard/server/requirement-example-assets"
import { buildVendorActionsUsage, buildVendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import { createTransactionContractArtifact } from "@/features/contracts/server/contract-artifacts"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import {
  buildRecreatedRequirementDocumentSeeds,
  buildReusableKycSeed,
  canReuseVerifiedKyc,
  deriveRecreatedTransactionStatus,
  getCompletedTransactionRecreateSource,
} from "@/features/transactions/server/transaction-recreation"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl } from "@/lib/integrations/stripe"
import { resolveRequestLocale } from "@/lib/i18n/locale-utils"
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
      const firstIssue = parsedBody.error.issues[0]
      const issuePath =
        firstIssue?.path && firstIssue.path.length > 0
          ? firstIssue.path
              .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
              .join(".")
              .replace(".[", "[")
          : null

      return NextResponse.json(
        {
          success: false,
          message: issuePath
            ? `${issuePath}: ${firstIssue?.message ?? "Invalid transaction data."}`
            : firstIssue?.message ?? "Invalid transaction data.",
        },
        { status: 400 }
      )
    }

    const {
      title,
      recreateFromTransactionId,
      notes,
      contractTemplateId,
      checklistTemplateId,
      amount,
      depositAmount,
      requiresKyc,
      generateQr,
      paymentCollectionTiming,
      requireClientCompany,
      requirements,
      customFields,
    } = parsedBody.data

    const normalizedAmount = typeof amount === "number" ? amount : null
    const normalizedDepositAmount = typeof depositAmount === "number" ? depositAmount : null
    const recreateSource = recreateFromTransactionId
      ? await getCompletedTransactionRecreateSource(vendorProfile.id, recreateFromTransactionId)
      : null

    if (recreateFromTransactionId && !recreateSource) {
      return NextResponse.json(
        {
          success: false,
          message: "The completed transaction selected for recreation could not be found.",
        },
        { status: 422 }
      )
    }

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

      if (
        remainingKyc !== null &&
        remainingKyc <= 0 &&
        !canReuseVerifiedKyc(recreateSource, Boolean(requiresKyc))
      ) {
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

    if (customFields.length > 0 && !contractTemplate) {
      return NextResponse.json(
        {
          success: false,
          message: "Select a contract template before adding customer fields that must be completed before signing.",
        },
        { status: 422 }
      )
    }

    const reference = `TX-${randomBytes(4).toString("hex").toUpperCase()}`
    const token = randomBytes(16).toString("hex")
    const baseUrl = getAppBaseUrl()
    const txLocale = resolveRequestLocale(request, vendorProfile.preferredLocale)
    const secureLink = `${baseUrl}/${txLocale}/t/${token}`
    const qrCodeSvg =
      generateQr === true
        ? await QRCode.toString(secureLink, { type: "svg", margin: 1 })
        : null
    let requirementOverrides: Array<{
      label: string
      instructions: string | null
      type: typeof requirements[number]["type"]
      category: typeof requirements[number]["category"]
      customCategoryLabel: string | null
      required: boolean
      sortOrder: number
      exampleImageUrl: string | null
      exampleImagePublicId: string | null
      exampleImageFileName: string | null
    }>

    try {
      requirementOverrides = requirements.map((item, index) => ({
        label: item.label,
        instructions: item.description,
        type: item.type,
        category: item.category,
        customCategoryLabel: item.customCategoryLabel,
        required: item.required,
        sortOrder: index,
        ...normalizeRequirementExampleImage(item, item.type, vendorProfile.id),
      }))
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: error instanceof Error ? error.message : "Invalid example image data.",
        },
        { status: 400 }
      )
    }

    const requirementDefinitions =
      requirementOverrides.length > 0
        ? requirementOverrides
        : (checklistTemplate?.items ?? []).map((item) => ({
            label: item.label,
            instructions: item.description,
            type: item.type,
            category: item.category,
            customCategoryLabel: item.customCategoryLabel,
            required: item.required,
            sortOrder: item.sortOrder,
            exampleImageUrl: item.exampleImageUrl,
            exampleImagePublicId: item.exampleImagePublicId,
            exampleImageFileName: item.exampleImageFileName,
          }))

    const customFieldDefinitions = customFields.map((item, index) => ({
      label: item.label,
      instructions: item.instructions,
      type: item.type,
      selectOptions: item.type === "SELECT" ? item.selectOptions : [],
      sortOrder: index,
    }))

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
      const clonedClientProfile = recreateSource?.clientProfile
        ? await tx.clientProfile.create({
            data: {
              userId: recreateSource.clientProfile.userId,
              vendorId: recreateSource.clientProfile.vendorId ?? vendorProfile.id,
              fullName: recreateSource.clientProfile.fullName,
              firstName: recreateSource.clientProfile.firstName,
              lastName: recreateSource.clientProfile.lastName,
              email: recreateSource.clientProfile.email,
              phone: recreateSource.clientProfile.phone,
              companyName: recreateSource.clientProfile.companyName,
              address: recreateSource.clientProfile.address,
              country: recreateSource.clientProfile.country,
              ...(recreateSource.clientProfile.metadata
                ? { metadata: recreateSource.clientProfile.metadata as Prisma.InputJsonValue }
                : {}),
            },
          })
        : null

      const newTransaction = await tx.transaction.create({
        data: {
          vendorId: vendorProfile.id,
          clientProfileId: clonedClientProfile?.id ?? null,
          reference,
          title,
          notes,
          kind,
          amount: normalizedAmount,
          depositAmount: normalizedDepositAmount,
          requiresKyc: Boolean(requiresKyc),
          paymentCollectionTiming,
          requireClientCompany,
          contractTemplateId: contractTemplate?.id ?? null,
          checklistTemplateId: checklistTemplate?.id ?? null,
          locale: txLocale,
          status: "LINK_SENT",
        },
      })

      const createdRequirements =
        requirementDefinitions.length > 0
          ? await Promise.all(
              requirementDefinitions.map((item) =>
                tx.transactionRequirement.create({
                  data: {
                    transactionId: newTransaction.id,
                    label: item.label,
                    instructions: item.instructions,
                    type: item.type,
                    category: item.category,
                    customCategoryLabel: item.customCategoryLabel,
                    required: item.required,
                    exampleImageUrl: item.exampleImageUrl,
                    exampleImagePublicId: item.exampleImagePublicId,
                    exampleImageFileName: item.exampleImageFileName,
                    sortOrder: item.sortOrder,
                  },
                })
              )
            )
          : []

      if (customFieldDefinitions.length > 0) {
        await Promise.all(
          customFieldDefinitions.map((item) =>
            tx.transactionCustomField.create({
              data: {
                transactionId: newTransaction.id,
                label: item.label,
                instructions: item.instructions,
                type: item.type,
                ...(item.type === "SELECT"
                  ? {
                      selectOptions: item.selectOptions as Prisma.InputJsonValue,
                    }
                  : {}),
                sortOrder: item.sortOrder,
              },
            })
          )
        )
      }

      if (contractTemplate) {
        await createTransactionContractArtifact(tx, {
          transactionId: newTransaction.id,
          contractTemplate: {
            id: contractTemplate.id,
            name: contractTemplate.name,
            description: contractTemplate.description,
            content: contractTemplate.content,
          },
        })
      }

      const recreatedDocuments = recreateSource
        ? buildRecreatedRequirementDocumentSeeds(recreateSource, createdRequirements)
        : {
            documents: [],
            reusedFileCount: 0,
            reusedTextCount: 0,
            allRequiredDocumentsPresent: createdRequirements
              .filter((requirement) => requirement.required)
              .length === 0,
          }

      if (recreatedDocuments.documents.length > 0) {
        await tx.documentAsset.createMany({
          data: recreatedDocuments.documents.map((document) => ({
            transactionId: newTransaction.id,
            clientProfileId: clonedClientProfile?.id ?? null,
            requirementId: document.requirementId,
            label: document.label,
            type: document.type,
            assetUrl: document.assetUrl,
            publicId: document.publicId,
            fileName: document.fileName,
            textValue: document.textValue,
          })),
        })
      }

      const reusableKyc = buildReusableKycSeed(recreateSource, Boolean(requiresKyc))

      if (reusableKyc) {
        await tx.kycVerification.create({
          data: {
            transactionId: newTransaction.id,
            provider: reusableKyc.provider,
            status: reusableKyc.status,
            providerReference: reusableKyc.providerReference,
            summary: reusableKyc.summary,
            verifiedAt: reusableKyc.verifiedAt,
          },
        })
      }

      const nextStatus = deriveRecreatedTransactionStatus({
        hasClientProfile: Boolean(clonedClientProfile),
        hasRequiredDocuments: recreatedDocuments.allRequiredDocumentsPresent,
        requiresKyc: Boolean(requiresKyc),
        hasVerifiedKyc: Boolean(reusableKyc),
      })

      if (nextStatus !== "LINK_SENT") {
        await tx.transaction.update({
          where: { id: newTransaction.id },
          data: { status: nextStatus },
        })
      }

      const link = await tx.transactionLink.create({
        data: {
          transactionId: newTransaction.id,
          token,
          shortCode: randomBytes(3).toString("hex").toUpperCase(),
          qrCodeSvg,
          status: TransactionLinkStatus.ACTIVE,
        },
      })

      if (recreateSource) {
        await recordTransactionEvent(tx, {
          transactionId: newTransaction.id,
          type: "TRANSACTION_RECREATED",
          title: "Completed transaction recreated",
          detail: `This workflow was recreated from completed transaction ${recreateSource.reference}.`,
          dedupeKey: `event:transaction-recreated:${newTransaction.id}`,
          metadata: {
            sourceTransactionId: recreateSource.id,
            sourceTransactionReference: recreateSource.reference,
            reusedDocumentCount: recreatedDocuments.reusedFileCount,
            reusedTextCount: recreatedDocuments.reusedTextCount,
            reusedKyc: Boolean(reusableKyc),
          },
        })
      }

      await recordTransactionEvent(tx, {
        transactionId: newTransaction.id,
        type: "LINK_CREATED",
        title: "Secure link created",
        detail: "The customer workflow is ready to be shared.",
        dedupeKey: `event:link-created:${newTransaction.id}`,
      })

      await incrementVendorSubscriptionUsageFields(tx, vendorProfile.id, {
        transactionsUsed: 1,
        qrCodesUsed: generateQr === true ? 1 : 0,
      })

      return {
        ...newTransaction,
        status: nextStatus,
        clientProfile: clonedClientProfile
          ? {
              fullName: clonedClientProfile.fullName,
              email: clonedClientProfile.email,
            }
          : null,
        link,
      }
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
