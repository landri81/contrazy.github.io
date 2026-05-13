import {
  KycStatus,
  Prisma,
  TransactionStatus,
  type DocumentAsset,
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
import { parseTransactionCustomFieldSelectOptions } from "@/features/transactions/custom-fields"
import { prisma } from "@/lib/db/prisma"

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
    orderBy: { uploadedAt: "asc" },
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
    "label" | "type" | "assetUrl" | "publicId" | "fileName" | "textValue"
  >
}

type RequirementReuseSeed = {
  requirementId: string
  label: string
  type: TransactionRequirement["type"]
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
    Pick<TransactionRequirement, "id" | "label" | "type" | "category" | "customCategoryLabel" | "required">
  >
) {
  const sourceDocumentsByRequirementId = new Map(
    source.documents
      .filter((document) => Boolean(document.requirementId))
      .map((document) => [document.requirementId as string, document])
  )

  const availableResponses: RequirementReuseSource[] = source.requirements.flatMap((requirement) => {
    const document = sourceDocumentsByRequirementId.get(requirement.id)

    if (!document || !isReusableRequirementDocument(requirement, document)) {
      return []
    }

    return [{ requirement, document }]
  })

  const usedSourceRequirementIds = new Set<string>()
  const documents: RequirementReuseSeed[] = []
  let reusedFileCount = 0
  let reusedTextCount = 0

  for (const requirement of targetRequirements) {
    const match = availableResponses.find(
      (candidate) =>
        !usedSourceRequirementIds.has(candidate.requirement.id) &&
        getRequirementReuseKey(candidate.requirement) === getRequirementReuseKey(requirement)
    )

    if (!match) {
      continue
    }

    usedSourceRequirementIds.add(match.requirement.id)

    if (requirement.type === "TEXT") {
      documents.push({
        requirementId: requirement.id,
        label: requirement.label,
        type: requirement.type,
        assetUrl: null,
        publicId: null,
        fileName: null,
        textValue: match.document.textValue?.trim() ?? null,
      })
      reusedTextCount += 1
      continue
    }

    documents.push({
      requirementId: requirement.id,
      label: requirement.label,
      type: requirement.type,
      assetUrl: match.document.assetUrl ?? null,
      publicId: match.document.publicId ?? null,
      fileName: match.document.fileName ?? match.document.label,
      textValue: null,
    })
    reusedFileCount += 1
  }

  const allRequiredDocumentsPresent = targetRequirements
    .filter((requirement) => requirement.required)
    .every((requirement) =>
      documents.some((document) =>
        document.requirementId === requirement.id &&
        (requirement.type === "TEXT" ? Boolean(document.textValue?.trim()) : Boolean(document.assetUrl && document.publicId))
      )
    )

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

function normalizeRequirementMatchValue(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase()
}
