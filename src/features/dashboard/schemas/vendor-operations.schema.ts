import { RequirementType } from "@prisma/client"
import { z } from "zod"

import {
  INPUT_LIMITS,
  MIN_DISPUTE_SUMMARY_LENGTH,
} from "@/lib/validation/input-limits"
import { optionalText, requiredText } from "@/lib/validation/text-schemas"

const optionalIdSchema = z.union([z.string().trim().min(1), z.null()]).optional()

export const vendorTransactionCreateSchema = z
  .object({
    title: requiredText("Title", INPUT_LIMITS.transactionTitle, {
      requiredMessage: "Title is required",
    }),
    notes: optionalText("Internal notes", INPUT_LIMITS.transactionNotes).optional(),
    contractTemplateId: optionalIdSchema,
    checklistTemplateId: optionalIdSchema,
    amount: z.number().int().nullable().optional(),
    depositAmount: z.number().int().nullable().optional(),
    requiresKyc: z.boolean().optional(),
    generateQr: z.boolean().optional(),
  })
  .transform((data) => ({
    ...data,
    notes: typeof data.notes === "string" && data.notes.length > 0 ? data.notes : null,
    contractTemplateId: typeof data.contractTemplateId === "string" ? data.contractTemplateId : null,
    checklistTemplateId: typeof data.checklistTemplateId === "string" ? data.checklistTemplateId : null,
    amount: data.amount ?? null,
    depositAmount: data.depositAmount ?? null,
    requiresKyc: Boolean(data.requiresKyc),
    generateQr: Boolean(data.generateQr),
  }))

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
    items: z
      .array(
        z.object({
          label: requiredText("Requirement label", INPUT_LIMITS.checklistItemLabel, {
            requiredMessage: "Requirement label is required",
          }),
          description: optionalText("Requirement instructions", INPUT_LIMITS.checklistItemInstructions).optional(),
          type: z.nativeEnum(RequirementType),
          required: z.boolean(),
        })
      )
      .min(1, "Add at least one requirement item"),
  })
  .transform((data) => ({
    ...data,
    description: typeof data.description === "string" && data.description.length > 0 ? data.description : null,
    items: data.items.map((item) => ({
      ...item,
      description: typeof item.description === "string" && item.description.length > 0 ? item.description : null,
    })),
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
