import {
  PaymentCollectionTiming,
  RequirementCategory,
  RequirementType,
  TransactionCustomFieldType,
  TransactionFlowType,
  TransactionReportFieldType,
  TransactionReportType,
} from "@prisma/client"
import { z } from "zod"

import { parseDateOnlyInput } from "@/lib/date-only"
import {
  normalizeRequirementFileCount,
  normalizeRequirementFileSlotLabels,
  requirementSupportsFileSlots,
} from "@/features/transactions/contract-flow"
import {
  INPUT_LIMITS,
  MIN_DISPUTE_SUMMARY_LENGTH,
} from "@/lib/validation/input-limits"
import { optionalNullableText, optionalText, requiredText } from "@/lib/validation/text-schemas"

const optionalIdSchema = z.union([z.string().trim().min(1), z.null()]).optional()
const optionalNullableStringSchema = z.union([z.string().trim(), z.null()]).optional()

const requirementItemSchema = z
  .object({
    label: requiredText("Requirement label", INPUT_LIMITS.checklistItemLabel, {
      requiredMessage: "Requirement label is required",
    }),
    description: optionalNullableText("Requirement instructions", INPUT_LIMITS.checklistItemInstructions).optional(),
    type: z.nativeEnum(RequirementType),
    category: z.nativeEnum(RequirementCategory),
    customCategoryLabel: optionalNullableText("Custom category label", INPUT_LIMITS.checklistItemLabel).optional(),
    required: z.boolean(),
    requiredFileCount: z.number().int().min(1).max(5).optional(),
    fileSlotLabels: z.array(z.string().trim()).optional(),
    exampleImageUrl: optionalNullableStringSchema,
    exampleImagePublicId: optionalNullableStringSchema,
    exampleImageFileName: optionalNullableStringSchema,
  })
  .superRefine((item, ctx) => {
    if (item.category === RequirementCategory.OTHER && !item.customCategoryLabel?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customCategoryLabel"],
        message: "Provide a display label when category is Other.",
      })
    }

    if (!requirementSupportsFileSlots(item.type)) {
      return
    }

    const normalizedCount = normalizeRequirementFileCount(item.type, item.requiredFileCount)
    const normalizedLabels = normalizeRequirementFileSlotLabels({
      type: item.type,
      fileCount: normalizedCount,
      labels: item.fileSlotLabels,
      requirementLabel: item.label,
    })

    if (normalizedLabels.some((label) => label.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fileSlotLabels"],
        message: "Provide a label for each required file slot.",
      })
    }

    if (Array.isArray(item.fileSlotLabels) && item.fileSlotLabels.length > normalizedCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fileSlotLabels"],
        message: "Provide exactly one slot label per required file.",
      })
    }
  })
  .transform((item) => ({
    ...item,
    requiredFileCount: normalizeRequirementFileCount(item.type, item.requiredFileCount),
    fileSlotLabels: normalizeRequirementFileSlotLabels({
      type: item.type,
      fileCount: normalizeRequirementFileCount(item.type, item.requiredFileCount),
      labels: item.fileSlotLabels,
      requirementLabel: item.label,
    }),
    description: typeof item.description === "string" && item.description.length > 0 ? item.description : null,
    customCategoryLabel:
      item.category === RequirementCategory.OTHER && typeof item.customCategoryLabel === "string" && item.customCategoryLabel.length > 0
        ? item.customCategoryLabel
        : null,
    exampleImageUrl:
      item.type !== RequirementType.TEXT && typeof item.exampleImageUrl === "string" && item.exampleImageUrl.length > 0
        ? item.exampleImageUrl
        : null,
    exampleImagePublicId:
      item.type !== RequirementType.TEXT &&
      typeof item.exampleImagePublicId === "string" &&
      item.exampleImagePublicId.length > 0
        ? item.exampleImagePublicId
        : null,
    exampleImageFileName:
      item.type !== RequirementType.TEXT &&
      typeof item.exampleImageFileName === "string" &&
      item.exampleImageFileName.length > 0
        ? item.exampleImageFileName
        : null,
  }))

const transactionCustomFieldItemSchema = z
  .object({
    label: requiredText("Customer field label", INPUT_LIMITS.checklistItemLabel, {
      requiredMessage: "Customer field label is required",
    }),
    instructions: optionalNullableText(
      "Customer field instructions",
      INPUT_LIMITS.checklistItemInstructions
    ).optional(),
    type: z.nativeEnum(TransactionCustomFieldType),
    selectOptions: z
      .array(
        requiredText("Select option", INPUT_LIMITS.checklistItemLabel, {
          requiredMessage: "Select option is required",
        })
      )
      .optional(),
  })
  .superRefine((item, ctx) => {
    const optionCount = Array.isArray(item.selectOptions) ? item.selectOptions.length : 0

    if (item.type === TransactionCustomFieldType.SELECT && optionCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectOptions"],
        message: "Select fields require at least two options.",
      })
    }
  })
  .transform((item) => ({
    ...item,
    instructions:
      typeof item.instructions === "string" && item.instructions.length > 0
        ? item.instructions
        : null,
    selectOptions:
      item.type === TransactionCustomFieldType.SELECT
        ? Array.isArray(item.selectOptions)
          ? item.selectOptions
          : []
        : [],
  }))

const transactionReportFieldItemSchema = z
  .object({
    label: requiredText("Report field label", INPUT_LIMITS.checklistItemLabel, {
      requiredMessage: "Report field label is required",
    }),
    instructions: optionalNullableText(
      "Report field instructions",
      INPUT_LIMITS.checklistItemInstructions
    ).optional(),
    fieldType: z.nativeEnum(TransactionReportFieldType),
    reportType: z.nativeEnum(TransactionReportType),
    selectOptions: z
      .array(
        requiredText("Select option", INPUT_LIMITS.checklistItemLabel, {
          requiredMessage: "Select option is required",
        })
      )
      .optional(),
  })
  .superRefine((item, ctx) => {
    const optionCount = Array.isArray(item.selectOptions) ? item.selectOptions.length : 0
    if (item.fieldType === TransactionReportFieldType.SELECT && optionCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectOptions"],
        message: "Select fields require at least two options.",
      })
    }
  })
  .transform((item) => ({
    ...item,
    instructions:
      typeof item.instructions === "string" && item.instructions.length > 0
        ? item.instructions
        : null,
    selectOptions:
      item.fieldType === TransactionReportFieldType.SELECT
        ? Array.isArray(item.selectOptions)
          ? item.selectOptions
          : []
        : [],
  }))

const vendorTransactionCreateBaseSchema = z.object({
  title: requiredText("Title", INPUT_LIMITS.transactionTitle, {
    requiredMessage: "Title is required",
  }),
  serviceDate: z
    .string()
    .trim()
    .min(1, "Service date is required")
    .refine((value) => Boolean(parseDateOnlyInput(value)), "Service date is required"),
  recreateFromTransactionId: optionalIdSchema,
  notes: optionalText("Internal notes", INPUT_LIMITS.transactionNotes).optional(),
  contractTemplateId: optionalIdSchema,
  checklistTemplateId: optionalIdSchema,
  amount: z.number().int().nullable().optional(),
  depositAmount: z.number().int().nullable().optional(),
  depositHoldDays: z.number().int().min(7).max(30).optional(),
  depositLongTermFeeAccepted: z.boolean().optional(),
  requiresKyc: z.boolean().optional(),
  generateQr: z.boolean().optional(),
  paymentCollectionTiming: z.nativeEnum(PaymentCollectionTiming).optional(),
  requireClientCompany: z.boolean().optional(),
  requirements: z.array(requirementItemSchema).optional(),
  customFields: z.array(transactionCustomFieldItemSchema).optional(),
  flowType: z.nativeEnum(TransactionFlowType).optional(),
  reportFields: z.array(transactionReportFieldItemSchema).optional(),
})

function normalizeVendorTransactionCreateData(data: z.infer<typeof vendorTransactionCreateBaseSchema>) {
  return {
    ...data,
    serviceDate: parseDateOnlyInput(data.serviceDate) ?? new Date(),
    recreateFromTransactionId:
      typeof data.recreateFromTransactionId === "string" ? data.recreateFromTransactionId : null,
    notes: typeof data.notes === "string" && data.notes.length > 0 ? data.notes : null,
    contractTemplateId: typeof data.contractTemplateId === "string" ? data.contractTemplateId : null,
    checklistTemplateId: typeof data.checklistTemplateId === "string" ? data.checklistTemplateId : null,
    amount: data.amount ?? null,
    depositAmount: data.depositAmount ?? null,
    depositHoldDays: data.depositHoldDays ?? 7,
    depositLongTermFeeAccepted: Boolean(data.depositLongTermFeeAccepted),
    requiresKyc: Boolean(data.requiresKyc),
    generateQr: Boolean(data.generateQr),
    paymentCollectionTiming: data.paymentCollectionTiming ?? PaymentCollectionTiming.AFTER_SIGNING,
    requireClientCompany: Boolean(data.requireClientCompany),
    requirements: Array.isArray(data.requirements) ? data.requirements : [],
    customFields: Array.isArray(data.customFields) ? data.customFields : [],
    flowType: data.flowType ?? TransactionFlowType.STANDARD,
    reportFields: Array.isArray(data.reportFields) ? data.reportFields : [],
  }
}

export const vendorTransactionCreateSchema = vendorTransactionCreateBaseSchema.transform(
  normalizeVendorTransactionCreateData
)

export type VendorTransactionCreateInput = z.infer<typeof vendorTransactionCreateSchema>

export const vendorBulkTransactionCreateSchema = vendorTransactionCreateBaseSchema
  .extend({
    recipientEmails: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .email("Recipient email must be valid")
      )
      .min(1, "Add at least one recipient email"),
    sourceFileName: optionalNullableText("CSV filename", 180).optional(),
  })
  .transform((data) => ({
    ...normalizeVendorTransactionCreateData(data),
    generateQr: false,
    recreateFromTransactionId: null,
    recipientEmails: Array.from(new Set(data.recipientEmails.map((email) => email.trim().toLowerCase()))),
    sourceFileName:
      typeof data.sourceFileName === "string" && data.sourceFileName.length > 0
        ? data.sourceFileName
        : null,
  }))

export type VendorBulkTransactionCreateInput = z.infer<typeof vendorBulkTransactionCreateSchema>

export const contractTemplatePayloadSchema = z
  .object({
    name: requiredText("Template name", INPUT_LIMITS.contractTemplateName, {
      requiredMessage: "Template name is required",
    }),
    description: optionalText("Template description", INPUT_LIMITS.contractTemplateDescription).optional(),
    content: requiredText("Contract terms", INPUT_LIMITS.contractContent, {
      requiredMessage: "Contract content is required",
    }),
  })
  .transform((data) => ({
    ...data,
    description: typeof data.description === "string" && data.description.length > 0 ? data.description : null,
  }))

export const checklistTemplatePayloadSchema = z
  .object({
    name: requiredText("Checklist name", INPUT_LIMITS.checklistName, {
      requiredMessage: "Checklist name is required",
    }),
    description: optionalText("Checklist description", INPUT_LIMITS.checklistDescription).optional(),
    items: z.array(requirementItemSchema).min(1, "Add at least one requirement item"),
  })
  .transform((data) => ({
    ...data,
    description: typeof data.description === "string" && data.description.length > 0 ? data.description : null,
  }))

export const vendorLinkUpdateSchema = z
  .object({
    title: requiredText("Title", INPUT_LIMITS.linkTitle, {
      requiredMessage: "Title is required",
    }),
    notes: optionalText("Internal notes", INPUT_LIMITS.linkNotes).optional(),
    expiresAt: z.union([z.string().trim().min(1), z.null()]).optional(),
  })
  .transform((data) => ({
    ...data,
    notes: typeof data.notes === "string" && data.notes.length > 0 ? data.notes : null,
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
  }))

export const vendorLinkCancelSchema = z
  .object({
    reason: optionalText("Cancellation reason", INPUT_LIMITS.cancelReason).optional(),
  })
  .transform((data) => ({
    reason: typeof data.reason === "string" && data.reason.length > 0 ? data.reason : null,
  }))

export const vendorDisputeCreateSchema = z.object({
  summary: requiredText("Dispute summary", INPUT_LIMITS.disputeSummary, {
    min: MIN_DISPUTE_SUMMARY_LENGTH,
    requiredMessage: `A description of at least ${MIN_DISPUTE_SUMMARY_LENGTH} characters is required`,
  }),
})
