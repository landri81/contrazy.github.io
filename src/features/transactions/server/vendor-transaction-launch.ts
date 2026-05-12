import { randomBytes } from "crypto"

import { NextResponse } from "next/server"
import QRCode from "qrcode"
import {
  Prisma,
  LocaleCode,
  StripeConnectionStatus,
  TransactionLinkStatus,
  TransactionStatus,
  type ChecklistItem,
  type ChecklistTemplate,
  type ContractTemplate,
  type VendorProfile,
  type VendorSubscription,
} from "@prisma/client"

import type { VendorTransactionCreateInput } from "@/features/dashboard/schemas/vendor-operations.schema"
import { normalizeRequirementExampleImage } from "@/features/dashboard/server/requirement-example-assets"
import { createTransactionContractArtifact } from "@/features/contracts/server/contract-artifacts"
import {
  canUseKyc,
  remainingKycVerifications,
  remainingQrCodes,
  remainingTransactions,
} from "@/features/subscriptions/server/feature-gates"
import { recordTransactionEvent } from "@/features/transactions/server/transaction-events"
import {
  buildRecreatedRequirementDocumentSeeds,
  buildReusableKycSeed,
  canReuseVerifiedKyc,
  deriveRecreatedTransactionStatus,
  getCompletedTransactionRecreateSource,
  type RecreateSourceTransaction,
} from "@/features/transactions/server/transaction-recreation"
import { prisma } from "@/lib/db/prisma"
import { resolveRequestLocale } from "@/lib/i18n/locale-utils"
import { getAppBaseUrl } from "@/lib/integrations/stripe"

type ChecklistWithItems = ChecklistTemplate & { items: ChecklistItem[] }

type RequirementDefinition = {
  label: string
  instructions: string | null
  type: VendorTransactionCreateInput["requirements"][number]["type"]
  category: VendorTransactionCreateInput["requirements"][number]["category"]
  customCategoryLabel: string | null
  required: boolean
  sortOrder: number
  exampleImageUrl: string | null
  exampleImagePublicId: string | null
  exampleImageFileName: string | null
}

type CustomFieldDefinition = {
  label: string
  instructions: string | null
  type: VendorTransactionCreateInput["customFields"][number]["type"]
  selectOptions: string[]
  sortOrder: number
}

export type PreparedVendorTransactionLaunch = {
  title: string
  notes: string | null
  amount: number | null
  depositAmount: number | null
  requiresKyc: boolean
  generateQr: boolean
  paymentCollectionTiming: VendorTransactionCreateInput["paymentCollectionTiming"]
  requireClientCompany: boolean
  contractTemplate: ContractTemplate | null
  checklistTemplate: ChecklistWithItems | null
  requirementDefinitions: RequirementDefinition[]
  customFieldDefinitions: CustomFieldDefinition[]
  kind: "PAYMENT" | "DEPOSIT" | "HYBRID"
  locale: LocaleCode
  baseUrl: string
  recreateSource: RecreateSourceTransaction | null
}

type PrepareLaunchInput = {
  request: Request
  vendorProfile: VendorProfile
  subscription: VendorSubscription
  data: VendorTransactionCreateInput
  recipientCount?: number
  forceGenerateQr?: boolean
  allowRecreate?: boolean
}

export type CreatedVendorTransaction = {
  id: string
  reference: string
  title: string
  kind: string
  status: TransactionStatus
  amount: number | null
  depositAmount: number | null
  currency: string
  locale: string
  notes: string | null
  updatedAt: Date
  secureLink: string
  clientProfile: {
    fullName: string
    email: string
  } | null
  link: {
    id: string
    token: string
    shortCode: string | null
    status: TransactionLinkStatus
    createdAt: Date
    openedAt: Date | null
    completedAt: Date | null
    expiresAt: Date | null
    cancelledAt: Date | null
    cancelReason: string | null
    cancelledBy: string | null
    qrCodeSvg: string | null
  }
}

export function formatVendorTransactionParseError(error: { issues: Array<{ path: PropertyKey[]; message?: string }> }) {
  const firstIssue = error.issues[0]
  const issuePath =
    firstIssue?.path && firstIssue.path.length > 0
      ? firstIssue.path
          .map((segment) => (typeof segment === "number" ? `[${segment}]` : String(segment)))
          .join(".")
          .replace(".[", "[")
      : null

  return issuePath
    ? `${issuePath}: ${firstIssue?.message ?? "Invalid transaction data."}`
    : firstIssue?.message ?? "Invalid transaction data."
}

export async function prepareVendorTransactionLaunch({
  request,
  vendorProfile,
  subscription,
  data,
  recipientCount = 1,
  forceGenerateQr,
  allowRecreate = true,
}: PrepareLaunchInput): Promise<
  | { ok: true; prepared: PreparedVendorTransactionLaunch }
  | { ok: false; response: NextResponse }
> {
  if (recipientCount < 1) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "Add at least one recipient." }, { status: 422 }),
    }
  }

  if (recipientCount > 100) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "Bulk CSV sharing supports up to 100 recipients at a time." }, { status: 422 }),
    }
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
  } = data

  if (recreateFromTransactionId && !allowRecreate) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "Bulk sharing cannot recreate a completed transaction." }, { status: 422 }),
    }
  }

  const normalizedAmount = typeof amount === "number" ? amount : null
  const normalizedDepositAmount = typeof depositAmount === "number" ? depositAmount : null
  const recreateSource = recreateFromTransactionId
    ? await getCompletedTransactionRecreateSource(vendorProfile.id, recreateFromTransactionId)
    : null

  if (recreateFromTransactionId && !recreateSource) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "The completed transaction selected for recreation could not be found." },
        { status: 422 }
      ),
    }
  }

  if (normalizedAmount !== null && (!Number.isInteger(normalizedAmount) || normalizedAmount < 0)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "Service payment amount must be a positive whole-cent value" }, { status: 422 }),
    }
  }

  if (normalizedDepositAmount !== null && (!Number.isInteger(normalizedDepositAmount) || normalizedDepositAmount < 0)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "Deposit amount must be a positive whole-cent value" }, { status: 422 }),
    }
  }

  if (normalizedAmount === 0 || normalizedDepositAmount === 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "Amounts must be greater than zero when provided" }, { status: 422 }),
    }
  }

  if (normalizedAmount === null && normalizedDepositAmount === null && requiresKyc) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Identity verification requires a connected Stripe account and a live transaction setup." },
        { status: 422 }
      ),
    }
  }

  const effectiveGenerateQr = forceGenerateQr ?? generateQr
  const needsStripe = Boolean(normalizedAmount || normalizedDepositAmount || requiresKyc)
  const remainingTransactionCount = remainingTransactions(subscription)

  if (remainingTransactionCount !== null && remainingTransactionCount < recipientCount) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Your current plan does not have enough remaining transactions for this launch." },
        { status: 422 }
      ),
    }
  }

  if (effectiveGenerateQr === true && (remainingQrCodes(subscription) ?? 1) <= 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Your current plan has reached its monthly QR code limit. Upgrade to create more." },
        { status: 422 }
      ),
    }
  }

  if (requiresKyc) {
    if (!canUseKyc(subscription)) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Identity verification is not available on your current plan." },
          { status: 422 }
        ),
      }
    }

    const remainingKyc = remainingKycVerifications(subscription)
    const canReuseSourceKyc = canReuseVerifiedKyc(recreateSource, Boolean(requiresKyc))

    if (remainingKyc !== null && remainingKyc < recipientCount && !canReuseSourceKyc) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Your included KYC verification quota is too low for this launch." },
          { status: 422 }
        ),
      }
    }
  }

  if (
    needsStripe &&
    (vendorProfile.stripeConnectionStatus !== StripeConnectionStatus.CONNECTED || !vendorProfile.stripeAccountId)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Connect Stripe before enabling payments, deposit holds, or identity verification." },
        { status: 422 }
      ),
    }
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
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "Selected contract template was not found for this account" }, { status: 422 }),
    }
  }

  if (checklistTemplateId && !checklistTemplate) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "Selected checklist was not found for this account" }, { status: 422 }),
    }
  }

  if (customFields.length > 0 && !contractTemplate) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Select a contract template before adding customer fields that must be completed before signing.",
        },
        { status: 422 }
      ),
    }
  }

  let requirementOverrides: RequirementDefinition[]

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
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: error instanceof Error ? error.message : "Invalid example image data." },
        { status: 400 }
      ),
    }
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

  if (!normalizedAmount && !normalizedDepositAmount) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "A service payment amount or deposit hold amount is required." },
        { status: 422 }
      ),
    }
  }

  let kind: "PAYMENT" | "DEPOSIT" | "HYBRID"
  if (normalizedAmount && normalizedDepositAmount) kind = "HYBRID"
  else if (normalizedDepositAmount) kind = "DEPOSIT"
  else kind = "PAYMENT"

  return {
    ok: true,
    prepared: {
      title,
      notes,
      amount: normalizedAmount,
      depositAmount: normalizedDepositAmount,
      requiresKyc: Boolean(requiresKyc),
      generateQr: effectiveGenerateQr,
      paymentCollectionTiming,
      requireClientCompany,
      contractTemplate,
      checklistTemplate,
      requirementDefinitions,
      customFieldDefinitions,
      kind,
      locale: resolveRequestLocale(request, vendorProfile.preferredLocale),
      baseUrl: getAppBaseUrl(),
      recreateSource,
    },
  }
}

export async function createPreparedVendorTransaction(
  tx: Prisma.TransactionClient,
  prepared: PreparedVendorTransactionLaunch,
  options: {
    vendorId: string
    bulkBatchId?: string | null
    cloneRecreateSource?: boolean
  }
): Promise<CreatedVendorTransaction> {
  const reference = `TX-${randomBytes(4).toString("hex").toUpperCase()}`
  const token = randomBytes(16).toString("hex")
  const secureLink = `${prepared.baseUrl}/${prepared.locale}/t/${token}`
  const qrCodeSvg =
    prepared.generateQr === true
      ? await QRCode.toString(secureLink, { type: "svg", margin: 1 })
      : null
  const shouldCloneRecreateSource = options.cloneRecreateSource ?? true

  const clonedClientProfile =
    shouldCloneRecreateSource && prepared.recreateSource?.clientProfile
      ? await tx.clientProfile.create({
          data: {
            userId: prepared.recreateSource.clientProfile.userId,
            vendorId: prepared.recreateSource.clientProfile.vendorId ?? options.vendorId,
            fullName: prepared.recreateSource.clientProfile.fullName,
            firstName: prepared.recreateSource.clientProfile.firstName,
            lastName: prepared.recreateSource.clientProfile.lastName,
            email: prepared.recreateSource.clientProfile.email,
            phone: prepared.recreateSource.clientProfile.phone,
            companyName: prepared.recreateSource.clientProfile.companyName,
            address: prepared.recreateSource.clientProfile.address,
            country: prepared.recreateSource.clientProfile.country,
            ...(prepared.recreateSource.clientProfile.metadata
              ? { metadata: prepared.recreateSource.clientProfile.metadata as Prisma.InputJsonValue }
              : {}),
          },
        })
      : null

  const newTransaction = await tx.transaction.create({
    data: {
      vendorId: options.vendorId,
      clientProfileId: clonedClientProfile?.id ?? null,
      bulkBatchId: options.bulkBatchId ?? null,
      reference,
      title: prepared.title,
      notes: prepared.notes,
      kind: prepared.kind,
      amount: prepared.amount,
      depositAmount: prepared.depositAmount,
      requiresKyc: prepared.requiresKyc,
      paymentCollectionTiming: prepared.paymentCollectionTiming,
      requireClientCompany: prepared.requireClientCompany,
      contractTemplateId: prepared.contractTemplate?.id ?? null,
      checklistTemplateId: prepared.checklistTemplate?.id ?? null,
      locale: prepared.locale,
      status: TransactionStatus.LINK_SENT,
    },
  })

  const createdRequirements =
    prepared.requirementDefinitions.length > 0
      ? await Promise.all(
          prepared.requirementDefinitions.map((item) =>
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

  if (prepared.customFieldDefinitions.length > 0) {
    await Promise.all(
      prepared.customFieldDefinitions.map((item) =>
        tx.transactionCustomField.create({
          data: {
            transactionId: newTransaction.id,
            label: item.label,
            instructions: item.instructions,
            type: item.type,
            ...(item.type === "SELECT"
              ? { selectOptions: item.selectOptions as Prisma.InputJsonValue }
              : {}),
            sortOrder: item.sortOrder,
          },
        })
      )
    )
  }

  if (prepared.contractTemplate) {
    await createTransactionContractArtifact(tx, {
      transactionId: newTransaction.id,
      contractTemplate: {
        id: prepared.contractTemplate.id,
        name: prepared.contractTemplate.name,
        description: prepared.contractTemplate.description,
        content: prepared.contractTemplate.content,
      },
    })
  }

  const recreatedDocuments =
    shouldCloneRecreateSource && prepared.recreateSource
      ? buildRecreatedRequirementDocumentSeeds(prepared.recreateSource, createdRequirements)
      : {
          documents: [],
          reusedFileCount: 0,
          reusedTextCount: 0,
          allRequiredDocumentsPresent:
            createdRequirements.filter((requirement) => requirement.required).length === 0,
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

  const reusableKyc =
    shouldCloneRecreateSource
      ? buildReusableKycSeed(prepared.recreateSource, prepared.requiresKyc)
      : null

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
    requiresKyc: prepared.requiresKyc,
    hasVerifiedKyc: Boolean(reusableKyc),
  })

  if (nextStatus !== TransactionStatus.LINK_SENT) {
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

  if (shouldCloneRecreateSource && prepared.recreateSource) {
    await recordTransactionEvent(tx, {
      transactionId: newTransaction.id,
      type: "TRANSACTION_RECREATED",
      title: "Completed transaction recreated",
      detail: `This workflow was recreated from completed transaction ${prepared.recreateSource.reference}.`,
      dedupeKey: `event:transaction-recreated:${newTransaction.id}`,
      metadata: {
        sourceTransactionId: prepared.recreateSource.id,
        sourceTransactionReference: prepared.recreateSource.reference,
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

  return {
    ...newTransaction,
    status: nextStatus,
    secureLink,
    clientProfile: clonedClientProfile
      ? {
          fullName: clonedClientProfile.fullName,
          email: clonedClientProfile.email,
        }
      : null,
    link,
  }
}
