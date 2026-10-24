import {
  KycStatus,
  Prisma,
  TransactionStatus,
  type DocumentAsset,
  type DocumentAssetSource,
  type KycVerification,
  type TransactionCustomField,
  type TransactionReportField,
  type TransactionRequirement,
} from "@prisma/client"

import type {
  TransactionCreationInitialCustomField,
  TransactionCreationInitialReportField,
  TransactionCreationInitialRequirement,
  TransactionCreationInitialValues,
} from "@/features/dashboard/transaction-creation"
import {
  isRequirementSlotSatisfied,
  normalizeRequirementFileSlotLabels,
} from "@/features/transactions/contract-flow"
import { parseTransactionCustomFieldSelectOptions } from "@/features/transactions/custom-fields"
import { prisma } from "@/lib/db/prisma"
import { toDateOnlyInputValue } from "@/lib/date-only"

const builtInRequirementCategories = new Set([
  "ID",
  "PROOF_OF_ADDRESS",
  "DRIVER_LICENSE",
  "COMPANY_REGISTRATION",
  "CONTRACT_ATTACHMENT",
])

export const recreateSourceTransactionInclude = {
  clientProfile: true,
  contractTemplate: {
    select: {
      id: true,
      name: true,
    },
  },
  contractArtifact: {
    select: {
      sourceTemplateName: true,
    },
  },
  link: {
    select: {
      qrCodeSvg: true,
    },
  },
  kycVerification: true,
  requirements: {
    orderBy: { sortOrder: "asc" },
  },
  customFields: {
    orderBy: { sortOrder: "asc" },
  },
  reportFields: {
    orderBy: { sortOrder: "asc" },
  },
  documents: {
    orderBy: [{ slotIndex: "asc" }, { uploadedAt: "asc" }],
  },
} satisfies Prisma.TransactionInclude

export type RecreateSourceTransaction = Prisma.TransactionGetPayload<{
  include: typeof recreateSourceTransactionInclude
}>

type RecreateInitialValueSource = {
  id: string
  reference: string
  title: string
  notes: string | null
  amount: number | null
  depositAmount: number | null
  depositHoldDays: number
  signatureCity: string | null
  serviceDate: Date | null
  contractTemplateId: string | null
  checklistTemplateId: string | null
  requiresKyc: boolean
  requireClientCompany: boolean
  paymentCollectionTiming: TransactionCreationInitialValues["paymentCollectionTiming"]
  flowType: TransactionCreationInitialValues["flowType"]
  contractTemplate?: { id: string; name: string } | null
  contractArtifact?: { sourceTemplateName: string | null } | null
  link?: { qrCodeSvg: string | null } | null
  requirements: Array<
    Pick<
      TransactionRequirement,
      | "label"
      | "instructions"
      | "type"
      | "category"
      | "customCategoryLabel"
      | "required"
      | "requiredFileCount"
      | "fileSlotLabels"
      | "exampleImageUrl"
      | "exampleImagePublicId"
      | "exampleImageFileName"
    >
  >
  customFields: Array<
    Pick<TransactionCustomField, "label" | "instructions" | "type" | "selectOptions">
  >
  reportFields: Array<
    Pick<TransactionReportField, "label" | "instructions" | "fieldType" | "reportType" | "selectOptions">
  >
}

type RequirementReuseSource = {
  requirement: Pick<
    TransactionRequirement,
    "id" | "label" | "type" | "category" | "customCategoryLabel" | "required"
  >
  document: Pick<
    DocumentAsset,
    | "label"
    | "type"
    | "slotIndex"
    | "slotLabel"
    | "source"
    | "capturedAt"
    | "assetUrl"
    | "publicId"
    | "fileName"
    | "textValue"
  >
}

type RequirementReuseSeed = {
  requirementId: string
  label: string
  type: TransactionRequirement["type"]
  slotIndex: number
  slotLabel: string | null
  source: DocumentAssetSource
  capturedAt: Date | null
  assetUrl: string | null
  publicId: string | null
  fileName: string | null
  textValue: string | null
}

export async function getCompletedTransactionRecreateSource(
  vendorId: string,
  transactionId: string
) {
  return prisma.transaction.findFirst({
    where: {
      id: transactionId,
      vendorId,
      status: TransactionStatus.COMPLETED,
    },
    include: recreateSourceTransactionInclude,
  })
}

export function buildTransactionCreationInitialValues(
  source: RecreateInitialValueSource,
  options: {
    availableContractIds: Iterable<string>
    availableChecklistIds: Iterable<string>
  }
): TransactionCreationInitialValues {
  const availableContractIds = new Set(options.availableContractIds)
  const availableChecklistIds = new Set(options.availableChecklistIds)
  const hasContractTemplate =
    Boolean(source.contractTemplateId) && availableContractIds.has(source.contractTemplateId as string)
  const hasChecklistTemplate =
    Boolean(source.checklistTemplateId) && availableChecklistIds.has(source.checklistTemplateId as string)

  return {
    sourceTransactionId: source.id,
    sourceTransactionReference: source.reference,
    title: source.title,
    notes: source.notes ?? "",
    amount: formatAmountForInput(source.amount),
    depositAmount: formatAmountForInput(source.depositAmount),
    depositHoldDays: source.depositHoldDays ?? 7,
    serviceDate: toDateOnlyInputValue(source.serviceDate),
    contractTemplateId: hasContractTemplate ? source.contractTemplateId : null,
    checklistTemplateId: hasChecklistTemplate ? source.checklistTemplateId : null,
    requiresKyc: source.requiresKyc,
    generateQr: Boolean(source.link?.qrCodeSvg),
    paymentCollectionTiming: source.paymentCollectionTiming,
    requireClientCompany: source.requireClientCompany,
    requirements: source.requirements.map((requirement) => toInitialRequirement(requirement)),
    customFields: source.customFields.map((field) => toInitialCustomField(field)),
    flowType: source.flowType as TransactionCreationInitialValues["flowType"],
    reportFields: source.reportFields.map((field) => toInitialReportField(field)),
    missingContractTemplateName:
      source.contractTemplateId && !hasContractTemplate
        ? source.contractArtifact?.sourceTemplateName ?? source.contractTemplate?.name ?? null
        : null,
  }
}

export function canReuseVerifiedKyc(
  source: Pick<RecreateSourceTransaction, "kycVerification"> | null,
  requiresKyc: boolean
) {
  return Boolean(requiresKyc && source?.kycVerification?.status === KycStatus.VERIFIED)
}

export function buildReusableKycSeed(
  source: Pick<RecreateSourceTransaction, "kycVerification"> | null,
  requiresKyc: boolean
) {
  if (!canReuseVerifiedKyc(source, requiresKyc) || !source?.kycVerification) {
    return null
  }

  return {
    provider: source.kycVerification.provider,
    status: KycStatus.VERIFIED,
    providerReference: source.kycVerification.providerReference,
    summary: source.kycVerification.summary,
    verifiedAt: source.kycVerification.verifiedAt ?? new Date(),
  } satisfies Pick<
    KycVerification,
    "provider" | "status" | "providerReference" | "summary" | "verifiedAt"
  >
}

export function buildRecreatedRequirementDocumentSeeds(
  source: Pick<RecreateSourceTransaction, "requirements" | "documents">,
  targetRequirements: Array<
    Pick<
      TransactionRequirement,
      | "id"
      | "label"
      | "type"
      | "category"
      | "customCategoryLabel"
      | "required"
      | "requiredFileCount"
      | "fileSlotLabels"
    >
  >
) {
  const sourceDocumentsByRequirementId = new Map<string, RequirementReuseSource["document"][]>()

  for (const document of source.documents) {
    if (!document.requirementId) {
      continue
    }

    const current = sourceDocumentsByRequirementId.get(document.requirementId) ?? []
    current.push(document)
    sourceDocumentsByRequirementId.set(document.requirementId, current)
  }

  const availableResponses: RequirementReuseSource[] = source.requirements.flatMap((requirement) => {
    const documents = sourceDocumentsByRequirementId.get(requirement.id) ?? []

    return documents.flatMap((document) =>
      isReusableRequirementDocument(requirement, document) ? [{ requirement, document }] : []
    )
  })

  const usedSourceDocumentKeys = new Set<string>()
  const documents: RequirementReuseSeed[] = []
  let reusedFileCount = 0
  let reusedTextCount = 0

  for (const requirement of targetRequirements) {
    if (requirement.type === "TEXT") {
      const match = availableResponses.find(
        (candidate) =>
          !usedSourceDocumentKeys.has(getRequirementReuseDocumentKey(candidate)) &&
          getRequirementReuseKey(candidate.requirement) === getRequirementReuseKey(requirement)
      )

      if (!match) {
        continue
      }

      usedSourceDocumentKeys.add(getRequirementReuseDocumentKey(match))

      documents.push({
        requirementId: requirement.id,
        label: requirement.label,
        type: requirement.type,
        slotIndex: 0,
        slotLabel: null,
        source: match.document.source ?? "UPLOAD",
        capturedAt: match.document.capturedAt ?? null,
        assetUrl: null,
        publicId: null,
        fileName: null,
        textValue: match.document.textValue?.trim() ?? null,
      })
      reusedTextCount += 1
      continue
    }

    const targetSlotLabels = normalizeRequirementFileSlotLabels({
      type: requirement.type,
      fileCount: requirement.requiredFileCount,
      labels: requirement.fileSlotLabels,
      requirementLabel: requirement.label,
    })

    const matches = availableResponses.filter(
      (candidate) =>
        !usedSourceDocumentKeys.has(getRequirementReuseDocumentKey(candidate)) &&
        getRequirementReuseKey(candidate.requirement) === getRequirementReuseKey(requirement)
    )

    for (let slotIndex = 0; slotIndex < targetSlotLabels.length; slotIndex += 1) {
      const match = matches.shift()

      if (!match) {
        break
      }

      usedSourceDocumentKeys.add(getRequirementReuseDocumentKey(match))

      documents.push({
        requirementId: requirement.id,
        label: requirement.label,
        type: requirement.type,
        slotIndex,
        slotLabel: targetSlotLabels[slotIndex] ?? null,
        source: match.document.source ?? "UPLOAD",
        capturedAt: match.document.capturedAt ?? null,
        assetUrl: match.document.assetUrl ?? null,
        publicId: match.document.publicId ?? null,
        fileName: match.document.fileName ?? match.document.label,
        textValue: null,
      })
      reusedFileCount += 1
    }
  }

  const allRequiredDocumentsPresent = targetRequirements
    .filter((requirement) => requirement.required)
    .every((requirement) => isRequirementSlotSatisfied(requirement, documents))

  return {
    documents,
    reusedFileCount,
    reusedTextCount,
    allRequiredDocumentsPresent,
  }
}

export function deriveRecreatedTransactionStatus(input: {
  hasClientProfile: boolean
  hasRequiredDocuments: boolean
  requiresKyc: boolean
  hasVerifiedKyc: boolean
}) {
  if (!input.hasClientProfile) {
    return TransactionStatus.LINK_SENT
  }

  if (!input.hasRequiredDocuments) {
    return TransactionStatus.CUSTOMER_STARTED
  }

  if (input.requiresKyc && input.hasVerifiedKyc) {
    return TransactionStatus.KYC_VERIFIED
  }

  return TransactionStatus.DOCS_SUBMITTED
}

function formatAmountForInput(amount: number | null) {
  if (!amount || amount <= 0) {
    return ""
  }

  return (amount / 100).toFixed(2)
}

function toInitialRequirement(
  requirement: RecreateInitialValueSource["requirements"][number]
): TransactionCreationInitialRequirement {
  return {
    label: requirement.label,
    description: requirement.instructions ?? "",
    type: requirement.type,
    category: requirement.category,
    customCategoryLabel: requirement.customCategoryLabel ?? "",
    required: requirement.required,
    requiredFileCount: requirement.requiredFileCount,
    fileSlotLabels: normalizeRequirementFileSlotLabels({
      type: requirement.type,
      fileCount: requirement.requiredFileCount,
      labels: requirement.fileSlotLabels,
      requirementLabel: requirement.label,
    }),
    exampleImage:
      requirement.exampleImageUrl && requirement.exampleImagePublicId
        ? {
            source: "saved",
            assetUrl: requirement.exampleImageUrl,
            publicId: requirement.exampleImagePublicId,
            fileName: requirement.exampleImageFileName ?? requirement.label,
          }
        : null,
  }
}

function toInitialCustomField(
  field: RecreateInitialValueSource["customFields"][number]
): TransactionCreationInitialCustomField {
  return {
    label: field.label,
    instructions: field.instructions ?? "",
    type: field.type,
    selectOptions: parseTransactionCustomFieldSelectOptions(field.selectOptions),
  }
}

function toInitialReportField(
  field: RecreateInitialValueSource["reportFields"][number]
): TransactionCreationInitialReportField {
  return {
    label: field.label,
    instructions: field.instructions ?? "",
    fieldType: field.fieldType as TransactionCreationInitialReportField["fieldType"],
    reportType: field.reportType as TransactionCreationInitialReportField["reportType"],
    selectOptions: parseTransactionCustomFieldSelectOptions(field.selectOptions),
  }
}

function isReusableRequirementDocument(
  requirement: Pick<TransactionRequirement, "type">,
  document: Pick<DocumentAsset, "assetUrl" | "publicId" | "textValue">
) {
  if (requirement.type === "TEXT") {
    return Boolean(document.textValue?.trim())
  }

  return Boolean(document.assetUrl && document.publicId)
}

function getRequirementReuseKey(
  requirement: Pick<TransactionRequirement, "label" | "type" | "category" | "customCategoryLabel">
) {
  if (builtInRequirementCategories.has(requirement.category)) {
    return `${requirement.type}:${requirement.category}`
  }

  if (requirement.category === "CUSTOM") {
    return `${requirement.type}:${requirement.category}:${normalizeRequirementMatchValue(requirement.label)}`
  }

  if (requirement.category === "OTHER") {
    return `${requirement.type}:${requirement.category}:${normalizeRequirementMatchValue(requirement.customCategoryLabel)}`
  }

  return `${requirement.type}:${requirement.category}:${normalizeRequirementMatchValue(requirement.label)}`
}

function getRequirementReuseDocumentKey(source: RequirementReuseSource) {
  return `${source.requirement.id}:${source.document.slotIndex ?? 0}:${source.document.label}`
}

function normalizeRequirementMatchValue(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}
