"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Variants } from "framer-motion"
import type { ChecklistItem, ChecklistTemplate, ContractTemplate } from "@prisma/client"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Info,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  Mail,
  MessageCircle,
  Plus,
  QrCode,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { Link } from "@/i18n/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { RequirementExampleImageField } from "@/features/dashboard/components/requirement-example-image-field"
import {
  cleanupVendorRequirementExampleImages,
  uploadVendorRequirementExampleImage,
  VendorRequirementExampleUploadError,
} from "@/features/dashboard/lib/vendor-requirement-example-upload-client"
import {
  type RequirementExampleCleanupAsset,
  type RequirementExampleDraft,
  toRequirementExampleCleanupAsset,
} from "@/features/dashboard/lib/vendor-requirement-example-images"
import type {
  TransactionCreationInitialCustomField,
  TransactionCreationInitialReportField,
  TransactionCreationInitialRequirement,
  TransactionCreationInitialValues,
  TransactionFlowTypeValue,
} from "@/features/dashboard/transaction-creation"
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import type {
  VendorActionsUsageRecord,
  VendorLinkRecord,
} from "@/features/dashboard/server/dashboard-data"
import {
  normalizeRequirementFileCount,
  normalizeRequirementFileSlotLabels,
  paymentCollectionTimingOptions,
  parseRequirementFileSlotLabels,
  requirementCategoryOptions,
  requirementSupportsFileSlots,
  requirementTypeOptions,
  type PaymentCollectionTimingValue,
  type RequirementCategoryValue,
  type RequirementTypeValue,
} from "@/features/transactions/contract-flow"
import {
  transactionCustomFieldTypeOptions,
  type TransactionCustomFieldTypeValue,
} from "@/features/transactions/custom-fields"

type TransactionCreationFormProps = {
  contracts: ContractTemplate[]
  checklists: Array<ChecklistTemplate & { items: ChecklistItem[] }>
  mode?: "new" | "recreate" | "bulk"
  initialValues?: TransactionCreationInitialValues | null
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  usage: VendorActionsUsageRecord | null
  onLinkCreated?: (record: VendorLinkRecord, usage: VendorActionsUsageRecord | null) => void
  onUsageUpdated?: (usage: VendorActionsUsageRecord | null) => void
  onDirtyChange?: (dirty: boolean) => void
  onSuccessStateChange?: (success: boolean) => void
}

type DraftRequirement = {
  id: string
  label: string
  description: string
  type: RequirementTypeValue
  category: RequirementCategoryValue
  customCategoryLabel: string
  required: boolean
  requiredFileCount: number
  fileSlotLabels: string[]
  exampleImage: RequirementExampleDraft | null
  sourceChecklistId: string | null
}

type DraftCustomField = {
  id: string
  label: string
  instructions: string
  type: TransactionCustomFieldTypeValue
  selectOptions: string[]
}

type DraftReportField = {
  id: string
  label: string
  instructions: string
  fieldType: TransactionCustomFieldTypeValue
  reportType: "CHECK_IN" | "CHECK_OUT"
  selectOptions: string[]
}

type StepDef = {
  key: "modules" | "basics" | "finance" | "setup" | "review"
  id: number
  label: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

type WorkflowModuleKey = "kyc" | "contract" | "photos" | "deposit" | "payment"

type WorkflowModulesState = Record<WorkflowModuleKey, boolean>

type BulkCsvPreview = {
  fileName: string
  totalRows: number
  validEmails: string[]
  duplicateCount: number
  rowsWithoutEmail: number
}

type BulkCreateResult = {
  batch: {
    id: string
    status: string
    recipientCount: number
    sentCount: number
    failedCount: number
  }
  rows: Array<{
    email: string
    reference: string
    transactionId: string
    secureLink: string
    deliveryStatus: string
  }>
}

const motionEase = [0.25, 0.46, 0.45, 0.94] as const

const stepVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: motionEase },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.18, ease: motionEase },
  },
}

const fieldLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-muted-foreground"

const controlClass =
  "h-9 rounded-sm border-border shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"

const textareaClass =
  "min-h-[68px] resize-none rounded-sm border-border shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"

const buttonPrimaryClass =
  "h-9 rounded-sm bg-[var(--contrazy-navy)] text-white shadow-none hover:opacity-90 focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"

const buttonSecondaryClass =
  "h-9 rounded-sm border-border shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"

function createRequirementId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `requirement-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeDraftRequirement(item: {
  label: string
  description: string
  type: RequirementTypeValue
  category: RequirementCategoryValue
  customCategoryLabel: string
  required: boolean
  requiredFileCount?: number
  fileSlotLabels?: string[]
  exampleImage: RequirementExampleDraft | null
}): Omit<DraftRequirement, "id" | "sourceChecklistId"> {
  const requiredFileCount = normalizeRequirementFileCount(item.type, item.requiredFileCount)
  const fileSlotLabels = normalizeRequirementFileSlotLabels({
    type: item.type,
    fileCount: requiredFileCount,
    labels: item.fileSlotLabels,
    requirementLabel: item.label,
  })

  return {
    ...item,
    requiredFileCount,
    fileSlotLabels,
    customCategoryLabel: item.category === "OTHER" ? item.customCategoryLabel : "",
    exampleImage: item.type === "TEXT" ? null : item.exampleImage,
  }
}

function createCustomFieldId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `custom-field-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createReportFieldId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `report-field-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createDraftReportField(
  reportType: "CHECK_IN" | "CHECK_OUT",
  item?: Partial<DraftReportField>
): DraftReportField {
  const fieldType = item?.fieldType ?? "TEXT"
  return {
    id: createReportFieldId(),
    label: item?.label ?? "",
    instructions: item?.instructions ?? "",
    fieldType,
    reportType,
    selectOptions:
      fieldType === "SELECT" && Array.isArray(item?.selectOptions) && item!.selectOptions.length > 0
        ? item!.selectOptions
        : fieldType === "SELECT"
          ? ["", ""]
          : [],
  }
}

function parseBulkCsvPreview(fileName: string, text: string): BulkCsvPreview {
  const emailPattern = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  const validEmails: string[] = []
  let duplicateCount = 0
  let rowsWithoutEmail = 0

  for (const row of rows) {
    const matches = row.match(emailPattern) ?? []

    if (matches.length === 0) {
      rowsWithoutEmail += 1
      continue
    }

    for (const match of matches) {
      const email = match.toLowerCase()

      if (seen.has(email)) {
        duplicateCount += 1
        continue
      }

      seen.add(email)
      validEmails.push(email)
    }
  }

  return {
    fileName,
    totalRows: rows.length,
    validEmails,
    duplicateCount,
    rowsWithoutEmail,
  }
}

function createDraftRequirement(item?: Partial<ChecklistItem>, sourceChecklistId: string | null = null): DraftRequirement {
  const exampleImage =
    item?.exampleImageUrl && item.exampleImagePublicId
      ? {
          source: "template" as const,
          assetUrl: item.exampleImageUrl,
          publicId: item.exampleImagePublicId,
          fileName: item.exampleImageFileName ?? item.label ?? "Example image",
        }
      : null

  return {
    id: createRequirementId(),
    ...normalizeDraftRequirement({
      label: item?.label ?? "",
      description: item?.description ?? "",
      type: (item?.type as RequirementTypeValue | undefined) ?? "DOCUMENT",
      category: (item?.category as RequirementCategoryValue | undefined) ?? "CUSTOM",
      customCategoryLabel: item?.customCategoryLabel ?? "",
      required: item?.required ?? true,
      requiredFileCount: item?.requiredFileCount ?? 1,
      fileSlotLabels: parseRequirementFileSlotLabels(item?.fileSlotLabels),
      exampleImage,
    }),
    sourceChecklistId,
  }
}

function createDraftRequirementFromInitialValue(
  item: TransactionCreationInitialRequirement
): DraftRequirement {
  return {
    id: createRequirementId(),
    ...normalizeDraftRequirement({
      label: item.label,
      description: item.description,
      type: item.type,
      category: item.category,
      customCategoryLabel: item.customCategoryLabel,
      required: item.required,
      requiredFileCount: item.requiredFileCount,
      fileSlotLabels: item.fileSlotLabels,
      exampleImage: item.exampleImage ? { ...item.exampleImage } : null,
    }),
    sourceChecklistId: null,
  }
}

function createDraftCustomField(
  item?: Partial<TransactionCreationInitialCustomField>
): DraftCustomField {
  const type = item?.type ?? "TEXT"

  return {
    id: createCustomFieldId(),
    label: item?.label ?? "",
    instructions: item?.instructions ?? "",
    type,
    selectOptions:
      type === "SELECT" &&
      Array.isArray(item?.selectOptions) &&
      item.selectOptions.length > 0
        ? item.selectOptions
        : type === "SELECT"
          ? ["", ""]
          : [],
  }
}

function createDraftCustomFieldFromInitialValue(
  item: TransactionCreationInitialCustomField
): DraftCustomField {
  return createDraftCustomField(item)
}

function getTemplateLabel(
  item: ContractTemplate | ChecklistTemplate | undefined,
  fallback: string
) {
  if (!item) return fallback
  const template = item as ContractTemplate &
    ChecklistTemplate & {
      name?: string | null
      title?: string | null
      label?: string | null
    }

  return template.name?.trim() || template.title?.trim() || template.label?.trim() || fallback
}

function parseEur(value: string): number | null {
  const amount = Number.parseFloat(value)
  if (Number.isNaN(amount) || amount <= 0) return null
  return Math.round(amount * 100)
}

function depositFee(amountEur: number) {
  const stripeFee = amountEur * 0.015 + 0.25
  const platformFee = amountEur * 0.005

  return {
    total: stripeFee + platformFee,
    stripeFee,
    platformFee,
    vendorNet: Math.max(0, amountEur - stripeFee - platformFee),
  }
}

function getLocalRequirementExampleAssets(requirements: DraftRequirement[]) {
  return requirements.flatMap((item) =>
    item.exampleImage?.source === "local"
      ? [toRequirementExampleCleanupAsset(item.exampleImage)]
      : []
  )
}

function createInitialWorkflowModules(
  initialValues?: TransactionCreationInitialValues | null
): WorkflowModulesState {
  const amount = Number.parseFloat(initialValues?.amount ?? "")
  const depositAmount = Number.parseFloat(initialValues?.depositAmount ?? "")

  return {
    kyc: Boolean(initialValues?.requiresKyc),
    contract: Boolean(
      initialValues?.contractTemplateId ||
        initialValues?.missingContractTemplateName ||
        (initialValues?.customFields?.length ?? 0) > 0
    ),
    photos: Boolean(
      initialValues?.checklistTemplateId || (initialValues?.requirements?.length ?? 0) > 0
    ),
    deposit: Number.isFinite(depositAmount) && depositAmount > 0,
    payment: Number.isFinite(amount) && amount > 0,
  }
}

function hasAnyWorkflowModuleSelected(modules: WorkflowModulesState) {
  return Object.values(modules).some(Boolean)
}

type TransactionCreationFormState = {
  enabledModules: WorkflowModulesState
  title: string
  notes: string
  amount: string
  depositAmount: string
  depositHoldDays: string
  serviceDate: string
  contractId: string
  checklistIds: string[]
  requiresKyc: boolean
  generateQr: boolean
  paymentCollectionTiming: PaymentCollectionTimingValue
  requireClientCompany: boolean
  requirements: DraftRequirement[]
  customFields: DraftCustomField[]
  flowType: TransactionFlowTypeValue
  reportFields: DraftReportField[]
}

type TransactionCreationFormSnapshot = Omit<
  TransactionCreationFormState,
  "requirements" | "customFields" | "reportFields"
> & {
    requirements: Array<{
      label: string
      description: string
      type: RequirementTypeValue
      category: RequirementCategoryValue
      customCategoryLabel: string
      required: boolean
      requiredFileCount: number
      fileSlotLabels: string[]
      exampleImage:
      | {
          source: RequirementExampleDraft["source"]
          assetUrl: string
          publicId: string
          fileName: string
        }
      | null
  }>
  customFields: Array<{
    label: string
    instructions: string
    type: TransactionCustomFieldTypeValue
    selectOptions: string[]
  }>
  reportFields: Array<{
    label: string
    instructions: string
    fieldType: TransactionCustomFieldTypeValue
    reportType: "CHECK_IN" | "CHECK_OUT"
    selectOptions: string[]
  }>
}

function createDraftReportFieldFromInitialValue(
  item: TransactionCreationInitialReportField
): DraftReportField {
  return createDraftReportField(item.reportType as "CHECK_IN" | "CHECK_OUT", {
    label: item.label,
    instructions: item.instructions,
    fieldType: item.fieldType,
    selectOptions: item.selectOptions,
  })
}

function createInitialFormState(
  initialValues?: TransactionCreationInitialValues | null
): TransactionCreationFormState {
  return {
    enabledModules: createInitialWorkflowModules(initialValues),
    title: initialValues?.title ?? "",
    notes: initialValues?.notes ?? "",
    amount: initialValues?.amount ?? "",
    depositAmount: initialValues?.depositAmount ?? "",
    depositHoldDays: String(initialValues?.depositHoldDays ?? 7),
    serviceDate: initialValues?.serviceDate ?? "",
    contractId: initialValues?.contractTemplateId ?? "none",
    checklistIds: [],
    requiresKyc: initialValues?.requiresKyc ?? false,
    generateQr: initialValues?.generateQr ?? false,
    paymentCollectionTiming: initialValues?.paymentCollectionTiming ?? "AFTER_SIGNING",
    requireClientCompany: initialValues?.requireClientCompany ?? false,
    requirements: (initialValues?.requirements ?? []).map((item) =>
      createDraftRequirementFromInitialValue(item)
    ),
    customFields: (initialValues?.customFields ?? []).map((item) =>
      createDraftCustomFieldFromInitialValue(item)
    ),
    flowType: initialValues?.flowType ?? "STANDARD",
    reportFields: (initialValues?.reportFields ?? []).map((item) =>
      createDraftReportFieldFromInitialValue(item)
    ),
  }
}

function buildFormSnapshot(state: TransactionCreationFormState): TransactionCreationFormSnapshot {
  return {
    enabledModules: state.enabledModules,
    title: state.title,
    notes: state.notes,
    amount: state.amount,
    depositAmount: state.depositAmount,
    depositHoldDays: state.depositHoldDays,
    serviceDate: state.serviceDate,
    contractId: state.contractId,
    checklistIds: state.checklistIds,
    requiresKyc: state.requiresKyc,
    generateQr: state.generateQr,
    paymentCollectionTiming: state.paymentCollectionTiming,
    requireClientCompany: state.requireClientCompany,
    flowType: state.flowType,
    requirements: state.requirements.map((item) => ({
      label: item.label,
      description: item.description,
      type: item.type,
      category: item.category,
      customCategoryLabel: item.customCategoryLabel,
      required: item.required,
      requiredFileCount: item.requiredFileCount,
      fileSlotLabels: item.fileSlotLabels,
      exampleImage: item.exampleImage
        ? {
            source: item.exampleImage.source,
            assetUrl: item.exampleImage.assetUrl,
            publicId: item.exampleImage.publicId,
            fileName: item.exampleImage.fileName,
          }
        : null,
    })),
    customFields: state.customFields.map((item) => ({
      label: item.label,
      instructions: item.instructions,
      type: item.type,
      selectOptions: item.type === "SELECT" ? item.selectOptions : [],
    })),
    reportFields: state.reportFields.map((item) => ({
      label: item.label,
      instructions: item.instructions,
      fieldType: item.fieldType,
      reportType: item.reportType,
      selectOptions: item.fieldType === "SELECT" ? item.selectOptions : [],
    })),
  }
}

function WizardStepper({ current, steps }: { current: number; steps: StepDef[] }) {
  return (
    <nav aria-label="Transaction creation steps" className="border-b border-border bg-background px-4 py-3 sm:px-5">
      <ol className="mx-auto flex max-w-3xl items-center gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon
          const active = current === step.id
          const done = current > step.id

          return (
            <React.Fragment key={step.id}>
              <li className="min-w-0 shrink-0">
                <div
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-sm px-2 text-xs font-semibold transition-colors",
                    active
                      ? "bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]"
                      : done
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-sm border text-[10px]",
                      active
                        ? "border-[var(--contrazy-teal)] text-[var(--contrazy-teal)]"
                        : done
                          ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-white"
                          : "border-border text-muted-foreground"
                    )}
                  >
                    {done ? <CheckCircle2 className="size-3" /> : <Icon className="size-3" />}
                  </span>
                  <span className="hidden truncate sm:block">{step.label}</span>
                </div>
              </li>

              {index < steps.length - 1 ? (
                <li aria-hidden="true" className="h-px min-w-3 flex-1 bg-border" />
              ) : null}
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

function StepHeader({ step }: { step: StepDef }) {
  const Icon = step.icon

  return (
    <header className="border-b border-border pb-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-[var(--contrazy-teal)]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {step.id}</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">{step.title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
        </div>
      </div>
    </header>
  )
}

function Section({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <section className={cn("border-b border-border py-4 last:border-b-0", className)}>{children}</section>
}

function Field({
  id,
  label,
  required,
  children,
  hint,
}: {
  id: string
  label: string
  required?: boolean
  children: React.ReactNode
  hint?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={fieldLabelClass}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <div className="text-xs leading-5 text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

function InlineNotice({
  tone = "neutral",
  icon: Icon = Info,
  children,
}: {
  tone?: "neutral" | "warning" | "error"
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-sm border px-3 py-2 text-xs leading-5",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300",
        tone === "error" && "border-destructive/25 bg-destructive/5 text-destructive",
        tone === "neutral" && "border-border bg-muted/30 text-muted-foreground"
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function SwitchRow({
  id,
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  children,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-border py-3 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium text-foreground">
            {title}
          </Label>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
          {children}
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-1 shrink-0 cursor-pointer data-[state=checked]:bg-[var(--contrazy-teal)]"
      />
    </div>
  )
}

function ModuleCard({
  icon: Icon,
  title,
  description,
  checked,
  disabled = false,
  note,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  note?: React.ReactNode
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex w-full cursor-pointer flex-col rounded-sm border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0",
        checked
          ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)]/10"
          : "border-border bg-background hover:bg-muted/35",
        disabled && "cursor-not-allowed opacity-60 hover:bg-background"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-sm border",
            checked
              ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-white"
              : "border-border bg-muted text-muted-foreground"
          )}
        >
          {checked ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          {note ? <div className="mt-2 text-xs leading-5 text-muted-foreground">{note}</div> : null}
        </div>
      </div>
    </button>
  )
}

function ErrorBlock({ error }: { error: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {error ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2 border-t border-destructive/15 bg-destructive/5 px-4 py-2.5 text-xs leading-5 text-destructive sm:px-5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <p>{error}</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function TransactionCreationForm({
  contracts,
  checklists,
  mode = "new",
  initialValues = null,
  hasStripe,
  canLaunch,
  blockedMessage,
  usage,
  onLinkCreated,
  onUsageUpdated,
  onDirtyChange,
  onSuccessStateChange,
}: TransactionCreationFormProps) {
  const t = useTranslations("dashboard.vendor.transactionCreation")
  const exampleT = useTranslations("dashboard.vendor.requirementExampleImage")
  const exampleCopy = {
    errorTitle: exampleT.has("errorTitle") ? exampleT("errorTitle") : "Example image error",
    invalidType: exampleT.has("errors.invalidType")
      ? exampleT("errors.invalidType")
      : "Only image files are allowed for requirement examples.",
    fileTooLarge: exampleT.has("errors.fileTooLarge")
      ? exampleT("errors.fileTooLarge")
      : "Example images must be 10 MB or smaller.",
    signingFailed: exampleT.has("errors.signingFailed")
      ? exampleT("errors.signingFailed")
      : "Upload signing is unavailable right now. Please try again.",
    uploadFailed: exampleT.has("errors.uploadFailed")
      ? exampleT("errors.uploadFailed")
      : "The example image could not be uploaded. Please try again.",
    unexpected: exampleT.has("errors.unexpected")
      ? exampleT("errors.unexpected")
      : "An unexpected error occurred while preparing the example image.",
  }
  const removeRequirementLabel = t.has("removeRequirement") ? t("removeRequirement") : "Remove"
  const isBulkMode = mode === "bulk"
  const initialFormState = useMemo(() => createInitialFormState(initialValues), [initialValues])
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        form: buildFormSnapshot(initialFormState),
        bulk: isBulkMode ? { fileName: "", recipients: [] as string[] } : null,
      }),
    [initialFormState, isBulkMode]
  )
  const recreateFromTransactionId =
    mode === "recreate" ? initialValues?.sourceTransactionId ?? null : null
  const recreateSourceReference =
    mode === "recreate" ? initialValues?.sourceTransactionReference ?? null : null
  const missingSourceContractTemplateName =
    mode === "recreate" ? initialValues?.missingContractTemplateName ?? null : null

  const reqCategoryLabels: Record<string, string> = {
    ID: t("reqCategoryId"),
    PROOF_OF_ADDRESS: t("reqCategoryProofOfAddress"),
    DRIVER_LICENSE: t("reqCategoryDriverLicense"),
    COMPANY_REGISTRATION: t("reqCategoryCompanyRegistration"),
    CONTRACT_ATTACHMENT: t("reqCategoryContractAttachment"),
    CUSTOM: t("reqCategoryCustom"),
    OTHER: t("reqCategoryOther"),
  }

  const reqTypeLabels: Record<string, string> = {
    DOCUMENT: t("reqTypeDocument"),
    PHOTO: t("reqTypePhoto"),
    CAPTURE: t("reqTypeCapture"),
    TEXT: t("reqTypeText"),
  }

  const customFieldTypeLabels: Record<string, string> = {
    TEXT: t("customFieldTypeText"),
    NUMBER: t("customFieldTypeNumber"),
    SELECT: t("customFieldTypeSelect"),
  }

  const paymentTimingLabels: Record<string, { label: string; description: string }> = {
    AFTER_SIGNING: {
      label: t("paymentTimingAfterSigningLabel"),
      description: t("paymentTimingAfterSigningDesc"),
    },
    AFTER_SERVICE: {
      label: t("paymentTimingAfterServiceLabel"),
      description: t("paymentTimingAfterServiceDesc"),
    },
  }
  const [step, setStep] = useState(1)
  const [enabledModules, setEnabledModules] = useState<WorkflowModulesState>(
    initialFormState.enabledModules
  )
  const [title, setTitle] = useState(initialFormState.title)
  const [notes, setNotes] = useState(initialFormState.notes)
  const [amount, setAmount] = useState(initialFormState.amount)
  const [depositAmount, setDepositAmount] = useState(initialFormState.depositAmount)
  const [depositHoldDays, setDepositHoldDays] = useState(initialFormState.depositHoldDays)
  const [serviceDate, setServiceDate] = useState(initialFormState.serviceDate)
  const [longDepositFeeAccepted, setLongDepositFeeAccepted] = useState(false)
  const [contractId, setContractId] = useState<string>(initialFormState.contractId)
  const [checklistIds, setChecklistIds] = useState<string[]>(initialFormState.checklistIds)
  const [requiresKyc, setRequiresKyc] = useState(initialFormState.requiresKyc)
  const [generateQr, setGenerateQr] = useState(initialFormState.generateQr)
  const [paymentCollectionTiming, setPaymentCollectionTiming] =
    useState<PaymentCollectionTimingValue>(initialFormState.paymentCollectionTiming)
  const [requireClientCompany, setRequireClientCompany] = useState(
    initialFormState.requireClientCompany
  )
  const [requirements, setRequirements] = useState<DraftRequirement[]>(
    initialFormState.requirements
  )
  const [customFields, setCustomFields] = useState<DraftCustomField[]>(
    initialFormState.customFields
  )
  const [enableCheckInOut, setEnableCheckInOut] = useState(
    initialFormState.flowType === "CHECK_IN_OUT"
  )
  const [reportFields, setReportFields] = useState<DraftReportField[]>(
    initialFormState.reportFields
  )

  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [successLink, setSuccessLink] = useState<string | null>(null)
  const [successRecord, setSuccessRecord] = useState<VendorLinkRecord | null>(null)
  const [bulkSuccess, setBulkSuccess] = useState<BulkCreateResult | null>(null)
  const [successError, setSuccessError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDownloadingQrImage, setIsDownloadingQrImage] = useState(false)
  const [isSharingQrImage, setIsSharingQrImage] = useState(false)
  const [uploadingRequirementIds, setUploadingRequirementIds] = useState<string[]>([])
  const [bulkCsvPreview, setBulkCsvPreview] = useState<BulkCsvPreview | null>(null)
  const qrCanvasContainerRef = useRef<HTMLDivElement | null>(null)
  const pendingLocalAssetsRef = useRef<RequirementExampleCleanupAsset[]>([])
  const skipPendingCleanupRef = useRef(false)

  const amountNum = Number.parseFloat(amount) || 0
  const depositNum = Number.parseFloat(depositAmount) || 0
  const depositHoldDaysValue = Number(depositHoldDays)
  const depositHoldDaysNum = Number.isFinite(depositHoldDaysValue)
    ? Math.trunc(depositHoldDaysValue)
    : 7
  const hasValidDepositHoldDays =
    Number.isInteger(depositHoldDaysValue) &&
    depositHoldDaysValue >= 7 &&
    depositHoldDaysValue <= 30
  const depositPricing = depositNum > 0 ? depositFee(depositNum) : null
  const isStarterPlan = usage?.planSlug === "starter" || !usage?.planSlug
  const canChooseLongDeposit = !isStarterPlan
  const isLongDeposit = depositNum > 0 && depositHoldDaysNum > 7
  const depositDaysInvalid =
    canChooseLongDeposit &&
    depositNum > 0 &&
    depositHoldDays !== "" &&
    !hasValidDepositHoldDays
  const financeDisabled = !canLaunch
  const qrRemaining = usage?.qrCodes.remaining ?? null
  const canUseKycInPlan = usage?.kyc.allowed ?? false
  const remainingKyc = usage?.kyc.remaining ?? null
  const qrToggleDisabled = isBulkMode || !canLaunch || (qrRemaining !== null && qrRemaining <= 0)
  const hasFinanceStep = enabledModules.payment || enabledModules.deposit
  const hasSetupStep =
    enabledModules.contract ||
    enabledModules.photos ||
    enabledModules.kyc ||
    enableCheckInOut
  const requiresStripeForSelection =
    enabledModules.payment || enabledModules.deposit || enabledModules.kyc
  const stripeSelectionNotice = !hasStripe && requiresStripeForSelection

  const steps = useMemo<StepDef[]>(
    () =>
      [
        {
          key: "modules",
          label: t("steps.modules.label"),
          title: t("steps.modules.title"),
          description: t("steps.modules.description"),
          icon: ClipboardList,
        },
        {
          key: "basics",
          label: t("steps.basics.label"),
          title: t("steps.basics.title"),
          description: t("steps.basics.description"),
          icon: FileText,
        },
        hasFinanceStep
          ? {
              key: "finance",
              label: t("steps.finance.label"),
              title: t("steps.finance.title"),
              description: t("steps.finance.description"),
              icon: CreditCard,
            }
          : null,
        hasSetupStep
          ? {
              key: "setup",
              label: t("steps.setup.label"),
              title: t("steps.setup.title"),
              description: t("steps.setup.description"),
              icon: ShieldCheck,
            }
          : null,
        {
          key: "review",
          label: t("steps.review.label"),
          title: t("steps.review.title"),
          description: t("steps.review.description"),
          icon: LinkIcon,
        },
      ]
        .filter(Boolean)
        .map((item, index) => ({
          ...(item as Omit<StepDef, "id">),
          id: index + 1,
        })),
    [hasFinanceStep, hasSetupStep, t]
  )

  const selectedContract = contracts.find((contract) => contract.id === contractId)
  const contractLabel =
    contractId === "none" ? t("noContract") : getTemplateLabel(selectedContract, t("selectedContract"))
  const selectedChecklistTemplates = checklists.filter((c) => checklistIds.includes(c.id))

  const txKind =
    amountNum > 0 && depositNum > 0
      ? "HYBRID"
      : depositNum > 0
        ? "DEPOSIT"
        : amountNum > 0
          ? "PAYMENT"
          : "WORKFLOW"

  const kindLabels: Record<string, string> = {
    PAYMENT: t("kindPayment"),
    DEPOSIT: t("kindDeposit"),
    HYBRID: t("kindHybrid"),
    WORKFLOW: t("kindWorkflow"),
  }

  const activeStep = steps[Math.min(step - 1, steps.length - 1)] || steps[0]!

  const clientSteps = [
    { key: "profile", label: t("clientStepProfile") },
    requirements.length > 0 && { key: "documents", label: t("clientStepDocuments") },
    requiresKyc && { key: "kyc", label: t("clientStepKyc") },
    customFields.length > 0 && contractId !== "none" && { key: "details", label: t("clientStepDetails") },
    contractId !== "none" && { key: "contract", label: t("clientStepContract") },
    enableCheckInOut && { key: "check-in", label: t("clientStepCheckIn") },
    depositNum > 0 && { key: "deposit", label: t("clientStepPayment") },
    amountNum > 0 && {
      key: "service-payment",
      label:
        depositNum > 0
          ? t("clientStepServicePayment")
          : t("clientStepServicePaymentOnly"),
    },
    { key: "complete", label: t("clientStepComplete") },
    enableCheckInOut && { key: "check-out", label: t("clientStepCheckOut") },
  ].filter(Boolean) as { key: string; label: string }[]

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify(
        {
          form: buildFormSnapshot({
            enabledModules,
            title,
            notes,
            amount,
            depositAmount,
            depositHoldDays,
            serviceDate,
            contractId,
            checklistIds,
            requiresKyc,
            generateQr: isBulkMode ? false : generateQr,
            paymentCollectionTiming,
            requireClientCompany,
            requirements,
            customFields,
            flowType: enableCheckInOut ? "CHECK_IN_OUT" : "STANDARD",
            reportFields: enableCheckInOut ? reportFields : [],
          }),
          bulk: isBulkMode
            ? {
                fileName: bulkCsvPreview?.fileName ?? "",
                recipients: bulkCsvPreview?.validEmails ?? [],
              }
            : null,
        }
      ),
    [
      amount,
      bulkCsvPreview,
      enabledModules,
      checklistIds,
      contractId,
      depositAmount,
      depositHoldDays,
      enableCheckInOut,
      generateQr,
      isBulkMode,
      notes,
      paymentCollectionTiming,
      serviceDate,
      requireClientCompany,
      requirements,
      customFields,
      reportFields,
      requiresKyc,
      title,
    ]
  )
  const isDirty = Boolean(successLink || bulkSuccess || step > 1 || currentSnapshot !== initialSnapshot)

  function translatedCategoryLabel(category: string, customLabel?: string | null) {
    if (category === "OTHER" && customLabel?.trim()) return customLabel.trim()
    return reqCategoryLabels[category] ?? t("reqCategoryCustom")
  }

  function mapExampleError(error: unknown) {
    if (!(error instanceof VendorRequirementExampleUploadError)) {
      return exampleCopy.unexpected
    }

    switch (error.code) {
      case "INVALID_TYPE":
        return exampleCopy.invalidType
      case "FILE_TOO_LARGE":
        return exampleCopy.fileTooLarge
      case "SIGNING_FAILED":
        return exampleCopy.signingFailed
      case "UPLOAD_FAILED":
      default:
        return error.message || exampleCopy.uploadFailed
    }
  }

  async function cleanupRequirementExampleAssets(
    assets: RequirementExampleCleanupAsset[],
    options?: { keepalive?: boolean }
  ) {
    if (assets.length === 0) {
      return
    }

    await cleanupVendorRequirementExampleImages(assets, options)
  }

  function handleAddBundle(bundleId: string) {
    if (checklistIds.includes(bundleId)) return
    const bundle = checklists.find((c) => c.id === bundleId)
    if (!bundle) return
    setChecklistIds((prev) => [...prev, bundleId])
    setRequirements((prev) => [
      ...prev,
      ...bundle.items.map((item) => createDraftRequirement(item, bundleId)),
    ])
  }

  function handleRemoveBundle(bundleId: string) {
    const removedLocalAssets = getLocalRequirementExampleAssets(
      requirements.filter((r) => r.sourceChecklistId === bundleId)
    )
    setChecklistIds((prev) => prev.filter((id) => id !== bundleId))
    setRequirements((prev) => prev.filter((r) => r.sourceChecklistId !== bundleId))
    if (removedLocalAssets.length > 0) {
      void cleanupRequirementExampleAssets(removedLocalAssets)
    }
  }

  function setWorkflowModuleEnabled(module: WorkflowModuleKey, checked: boolean) {
    setEnabledModules((current) => ({
      ...current,
      [module]: checked,
    }))
    setStepError(null)
    setError(null)

    if (module === "payment" && !checked) {
      setAmount("")
      setPaymentCollectionTiming("AFTER_SIGNING")
    }

    if (module === "deposit" && !checked) {
      setDepositAmount("")
      setDepositHoldDays("7")
      setLongDepositFeeAccepted(false)
    }

    if (module === "kyc") {
      setRequiresKyc(checked)
    }

    if (module === "contract" && !checked) {
      setContractId("none")
      setCustomFields([])
    }

    if (module === "photos" && !checked) {
      const removedLocalAssets = getLocalRequirementExampleAssets(requirements)
      setChecklistIds([])
      setRequirements([])

      if (removedLocalAssets.length > 0) {
        void cleanupRequirementExampleAssets(removedLocalAssets)
      }
    }
  }

  useEffect(() => {
    pendingLocalAssetsRef.current = getLocalRequirementExampleAssets(requirements)
  }, [requirements])

  useEffect(() => {
    return () => {
      if (skipPendingCleanupRef.current || pendingLocalAssetsRef.current.length === 0) {
        return
      }

      void cleanupRequirementExampleAssets(pendingLocalAssetsRef.current, {
        keepalive: true,
      })
    }
  }, [])

  useEffect(() => {
    if (amountNum <= 0 && paymentCollectionTiming === "AFTER_SERVICE") {
      setPaymentCollectionTiming("AFTER_SIGNING")
    }
  }, [amountNum, paymentCollectionTiming])

  useEffect(() => {
    if (isBulkMode && generateQr) {
      setGenerateQr(false)
    }
  }, [generateQr, isBulkMode])

  useEffect(() => {
    if (!canChooseLongDeposit && depositHoldDays !== "7") {
      setDepositHoldDays("7")
      setLongDepositFeeAccepted(false)
    }
  }, [canChooseLongDeposit, depositHoldDays])

  useEffect(() => {
    if (!isLongDeposit && longDepositFeeAccepted) {
      setLongDepositFeeAccepted(false)
    }
  }, [isLongDeposit, longDepositFeeAccepted])

  useEffect(() => {
    if (step > steps.length) {
      setStep(steps.length)
    }
  }, [step, steps.length])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    onSuccessStateChange?.(Boolean(successLink || bulkSuccess))
  }, [bulkSuccess, onSuccessStateChange, successLink])

  function navigate(nextStep: number) {
    setStepError(null)
    setError(null)
    setStep(Math.min(Math.max(nextStep, 1), steps.length))
  }

  async function handleBulkCsvFile(file: File | null) {
    setStepError(null)
    setError(null)

    if (!file) {
      return
    }

    const isCsv =
      file.name.toLowerCase().endsWith(".csv") ||
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel"

    if (!isCsv) {
      setStepError(t("bulkCsvInvalidType"))
      return
    }

    const text = await file.text()
    const preview = parseBulkCsvPreview(file.name, text)

    if (preview.validEmails.length === 0) {
      setBulkCsvPreview(preview)
      setStepError(t("bulkCsvNoEmails"))
      return
    }

    if (preview.validEmails.length > 100) {
      setBulkCsvPreview(preview)
      setStepError(t("bulkCsvTooMany", { count: preview.validEmails.length }))
      return
    }

    setBulkCsvPreview(preview)
  }

  function clearBulkCsv() {
    setBulkCsvPreview(null)
    setStepError(null)
  }

  function addRequirement() {
    setRequirements((current) => [...current, createDraftRequirement()])
  }

  function addCustomField() {
    setCustomFields((current) => [...current, createDraftCustomField()])
  }

  function updateRequirement(requirementId: string, patch: Partial<DraftRequirement>) {
    setRequirements((current) =>
      current.map((item) => {
        if (item.id !== requirementId) return item

        return {
          id: item.id,
          ...normalizeDraftRequirement({
            label: patch.label ?? item.label,
            description: patch.description ?? item.description,
            type: patch.type ?? item.type,
            category: patch.category ?? item.category,
            customCategoryLabel: patch.customCategoryLabel ?? item.customCategoryLabel,
            required: patch.required ?? item.required,
            requiredFileCount: patch.requiredFileCount ?? item.requiredFileCount,
            fileSlotLabels: patch.fileSlotLabels ?? item.fileSlotLabels,
            exampleImage: patch.exampleImage ?? item.exampleImage,
          }),
          sourceChecklistId: item.sourceChecklistId,
        }
      })
    )
  }

  function updateRequirementFileCount(requirementId: string, nextValue: string) {
    const parsed = Number.parseInt(nextValue.replace(/[^0-9]/g, ""), 10)

    updateRequirement(requirementId, {
      requiredFileCount: Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 5) : 1,
    })
  }

  function updateRequirementSlotLabel(
    requirementId: string,
    slotIndex: number,
    nextValue: string
  ) {
    const requirement = requirements.find((item) => item.id === requirementId)

    if (!requirement) {
      return
    }

    const nextLabels = [...requirement.fileSlotLabels]
    nextLabels[slotIndex] = nextValue
    updateRequirement(requirementId, { fileSlotLabels: nextLabels })
  }

  function updateCustomField(customFieldId: string, patch: Partial<DraftCustomField>) {
    setCustomFields((current) =>
      current.map((item) => {
        if (item.id !== customFieldId) return item

        const nextType = patch.type ?? item.type
        return {
          ...item,
          ...patch,
          selectOptions:
            nextType === "SELECT"
              ? (patch.selectOptions ?? (item.selectOptions.length > 0 ? item.selectOptions : ["", ""]))
              : [],
        }
      })
    )
  }

  function updateCustomFieldSelectOption(
    customFieldId: string,
    optionIndex: number,
    nextValue: string
  ) {
    setCustomFields((current) =>
      current.map((item) => {
        if (item.id !== customFieldId || item.type !== "SELECT") return item

        const nextOptions = [...item.selectOptions]
        nextOptions[optionIndex] = nextValue

        return {
          ...item,
          selectOptions: nextOptions,
        }
      })
    )
  }

  function addCustomFieldSelectOption(customFieldId: string) {
    setCustomFields((current) =>
      current.map((item) =>
        item.id === customFieldId && item.type === "SELECT"
          ? { ...item, selectOptions: [...item.selectOptions, ""] }
          : item
      )
    )
  }

  function removeCustomFieldSelectOption(customFieldId: string, optionIndex: number) {
    setCustomFields((current) =>
      current.map((item) => {
        if (item.id !== customFieldId || item.type !== "SELECT") return item

        const nextOptions = item.selectOptions.filter((_, index) => index !== optionIndex)

        return {
          ...item,
          selectOptions: nextOptions.length > 0 ? nextOptions : ["", ""],
        }
      })
    )
  }

  function removeRequirement(requirementId: string) {
    const currentExampleImage = requirements.find((item) => item.id === requirementId)?.exampleImage
    setRequirements((current) => current.filter((item) => item.id !== requirementId))

    if (currentExampleImage?.source === "local") {
      void cleanupRequirementExampleAssets([toRequirementExampleCleanupAsset(currentExampleImage)])
    }
  }

  function removeCustomField(customFieldId: string) {
    setCustomFields((current) => current.filter((item) => item.id !== customFieldId))
  }

  function addReportField(reportType: "CHECK_IN" | "CHECK_OUT") {
    setReportFields((current) => [...current, createDraftReportField(reportType)])
  }

  function updateReportField(reportFieldId: string, patch: Partial<DraftReportField>) {
    setReportFields((current) =>
      current.map((item) => {
        if (item.id !== reportFieldId) return item
        const nextFieldType = patch.fieldType ?? item.fieldType
        return {
          ...item,
          ...patch,
          selectOptions:
            nextFieldType === "SELECT"
              ? (patch.selectOptions ?? (item.selectOptions.length > 0 ? item.selectOptions : ["", ""]))
              : [],
        }
      })
    )
  }

  function updateReportFieldSelectOption(reportFieldId: string, optionIndex: number, nextValue: string) {
    setReportFields((current) =>
      current.map((item) => {
        if (item.id !== reportFieldId || item.fieldType !== "SELECT") return item
        const nextOptions = [...item.selectOptions]
        nextOptions[optionIndex] = nextValue
        return { ...item, selectOptions: nextOptions }
      })
    )
  }

  function addReportFieldSelectOption(reportFieldId: string) {
    setReportFields((current) =>
      current.map((item) =>
        item.id === reportFieldId && item.fieldType === "SELECT"
          ? { ...item, selectOptions: [...item.selectOptions, ""] }
          : item
      )
    )
  }

  function removeReportFieldSelectOption(reportFieldId: string, optionIndex: number) {
    setReportFields((current) =>
      current.map((item) => {
        if (item.id !== reportFieldId || item.fieldType !== "SELECT") return item
        const nextOptions = item.selectOptions.filter((_, index) => index !== optionIndex)
        return { ...item, selectOptions: nextOptions.length > 0 ? nextOptions : ["", ""] }
      })
    )
  }

  function removeReportField(reportFieldId: string) {
    setReportFields((current) => current.filter((item) => item.id !== reportFieldId))
  }

  function handleReportFieldTypeChange(reportFieldId: string, nextType: TransactionCustomFieldTypeValue) {
    updateReportField(reportFieldId, {
      fieldType: nextType,
      selectOptions: nextType === "SELECT" ? ["", ""] : [],
    })
  }

  function handleRequirementTypeChange(requirementId: string, nextType: RequirementTypeValue) {
    const currentExampleImage = requirements.find((item) => item.id === requirementId)?.exampleImage

    updateRequirement(requirementId, { type: nextType })

    if (nextType === "TEXT" && currentExampleImage?.source === "local") {
      void cleanupRequirementExampleAssets([toRequirementExampleCleanupAsset(currentExampleImage)])
    }
  }

  function handleCustomFieldTypeChange(
    customFieldId: string,
    nextType: TransactionCustomFieldTypeValue
  ) {
    updateCustomField(customFieldId, {
      type: nextType,
      selectOptions: nextType === "SELECT" ? ["", ""] : [],
    })
  }

  async function handleRequirementExampleUpload(requirementId: string, file: File) {
    const currentRequirement = requirements.find((item) => item.id === requirementId)
    const previousExampleImage = currentRequirement?.exampleImage

    setError(null)
    setUploadingRequirementIds((current) =>
      current.includes(requirementId) ? current : [...current, requirementId]
    )

    try {
      const uploaded = await uploadVendorRequirementExampleImage(file)

      let replacedLocalAsset: RequirementExampleCleanupAsset | null = null
      let orphanedUploadAsset: RequirementExampleCleanupAsset | null = null

      setRequirements((current) => {
        const requirementIndex = current.findIndex((item) => item.id === requirementId)

        if (requirementIndex === -1) {
          orphanedUploadAsset = toRequirementExampleCleanupAsset(uploaded)
          return current
        }

        const target = current[requirementIndex]

        if (target.type === "TEXT") {
          orphanedUploadAsset = toRequirementExampleCleanupAsset(uploaded)
          return current
        }

        if (
          target.exampleImage?.source === "local" &&
          target.exampleImage.publicId !== uploaded.publicId
        ) {
          replacedLocalAsset = toRequirementExampleCleanupAsset(target.exampleImage)
        }

        const next = [...current]
        next[requirementIndex] = {
          ...target,
          exampleImage: {
            source: "local",
            ...uploaded,
          },
        }
        return next
      })

      if (orphanedUploadAsset) {
        void cleanupRequirementExampleAssets([orphanedUploadAsset])
        return
      }

      if (replacedLocalAsset) {
        void cleanupRequirementExampleAssets([replacedLocalAsset])
      } else if (
        previousExampleImage?.source === "local" &&
        previousExampleImage.publicId !== uploaded.publicId &&
        !requirements.some(
          (item) =>
            item.id === requirementId &&
            item.exampleImage?.source === "local" &&
            item.exampleImage.publicId === previousExampleImage.publicId
        )
      ) {
        void cleanupRequirementExampleAssets([toRequirementExampleCleanupAsset(previousExampleImage)])
      }
    } catch (error) {
      toast({
        variant: "error",
        title: exampleCopy.errorTitle,
        description: mapExampleError(error),
      })
    } finally {
      setUploadingRequirementIds((current) =>
        current.filter((currentRequirementId) => currentRequirementId !== requirementId)
      )
    }
  }

  function handleRequirementExampleRemove(requirementId: string) {
    const currentExampleImage = requirements.find((item) => item.id === requirementId)?.exampleImage

    if (!currentExampleImage) {
      return
    }

    updateRequirement(requirementId, { exampleImage: null })

    if (currentExampleImage.source === "local") {
      void cleanupRequirementExampleAssets([toRequirementExampleCleanupAsset(currentExampleImage)])
    }
  }

  function validateCurrentStep() {
    setStepError(null)

    if (activeStep?.key === "modules" && !hasAnyWorkflowModuleSelected(enabledModules)) {
      setStepError(t("errorNoModules"))
      return false
    }

    if (activeStep?.key === "basics" && !title.trim()) {
      setStepError(t("errorTitle"))
      return false
    }

    if (activeStep?.key === "basics" && !serviceDate) {
      setStepError(t("errorServiceDate"))
      return false
    }

    if (activeStep?.key === "basics" && isBulkMode) {
      if (!bulkCsvPreview || bulkCsvPreview.validEmails.length === 0) {
        setStepError(t("bulkCsvRequired"))
        return false
      }

      if (bulkCsvPreview.validEmails.length > 100) {
        setStepError(t("bulkCsvTooMany", { count: bulkCsvPreview.validEmails.length }))
        return false
      }
    }

    if (activeStep?.key === "finance") {
      if (
        enabledModules.payment &&
        (!amount || Number.isNaN(Number.parseFloat(amount)) || Number.parseFloat(amount) < 0.5)
      ) {
        setStepError(t("errorMinService"))
        return false
      }

      if (
        enabledModules.deposit &&
        (!depositAmount ||
          Number.isNaN(Number.parseFloat(depositAmount)) ||
          Number.parseFloat(depositAmount) < 0.5)
      ) {
        setStepError(t("errorMinDeposit"))
        return false
      }

      if (enabledModules.deposit && depositNum > 0) {
        if (
          !hasValidDepositHoldDays
        ) {
          setStepError(t("errorDepositDuration"))
          return false
        }

        if (isLongDeposit && !canChooseLongDeposit) {
          setStepError(t("errorDepositDurationStarter"))
          return false
        }

        if (isLongDeposit && !longDepositFeeAccepted) {
          setStepError(t("errorLongDepositAcceptance"))
          return false
        }
      }
    }

    if (activeStep?.key === "setup") {
      if (enabledModules.contract && contractId === "none") {
        setStepError(t("errorContractRequired"))
        return false
      }

      if (enabledModules.photos && requirements.length === 0) {
        setStepError(t("errorRequirementsRequired"))
        return false
      }

      const invalidRequirement = requirements.find(
        (item) => !item.label.trim() || (item.category === "OTHER" && !item.customCategoryLabel.trim())
      )

      if (enabledModules.photos && invalidRequirement) {
        setStepError(t("errorRequirements"))
        return false
      }

      if (customFields.length > 0 && contractId === "none") {
        setStepError(t("errorCustomFieldsContract"))
        return false
      }

      const invalidCustomField = customFields.find((item) => {
        if (!item.label.trim()) {
          return true
        }

        if (item.type !== "SELECT") {
          return false
        }

        return item.selectOptions.filter((option) => option.trim().length > 0).length < 2
      })

      if (invalidCustomField) {
        setStepError(t("errorCustomFields"))
        return false
      }

      if (enableCheckInOut) {
        const invalidReportField = reportFields.find((item) => {
          if (!item.label.trim()) return true
          if (item.fieldType !== "SELECT") return false
          return item.selectOptions.filter((opt) => opt.trim().length > 0).length < 2
        })

        if (invalidReportField) {
          setStepError(t("errorReportFields"))
          return false
        }
      }
    }

    return true
  }

  function handleNext() {
    if (!validateCurrentStep()) return
    navigate(step + 1)
  }

  async function handleSubmit() {
    setError(null)

    if (!canLaunch) {
      setError(blockedMessage)
      return
    }

    if (!hasAnyWorkflowModuleSelected(enabledModules)) {
      setError(t("errorNoModules"))
      navigate(1)
      return
    }

    if (requiresStripeForSelection && !hasStripe) {
      setError(t("errorNoStripe"))
      navigate(enabledModules.payment || enabledModules.deposit ? steps.findIndex((item) => item.key === "finance") + 1 : steps.findIndex((item) => item.key === "setup") + 1)
      return
    }

    if (enabledModules.payment && amountNum <= 0) {
      setError(t("errorAmountRequired"))
      navigate(steps.findIndex((item) => item.key === "finance") + 1)
      return
    }

    if (enabledModules.deposit && depositNum <= 0) {
      setError(t("errorDepositAmountRequired"))
      navigate(steps.findIndex((item) => item.key === "finance") + 1)
      return
    }

    if (!serviceDate) {
      setError(t("errorServiceDate"))
      navigate(steps.findIndex((item) => item.key === "basics") + 1)
      return
    }

    if (enabledModules.deposit && depositNum > 0) {
      if (
        !hasValidDepositHoldDays
      ) {
        setError(t("errorDepositDuration"))
        navigate(steps.findIndex((item) => item.key === "finance") + 1)
        return
      }

      if (isLongDeposit && !canChooseLongDeposit) {
        setError(t("errorDepositDurationStarter"))
        navigate(steps.findIndex((item) => item.key === "finance") + 1)
        return
      }

      if (isLongDeposit && !longDepositFeeAccepted) {
        setError(t("errorLongDepositAcceptance"))
        navigate(steps.findIndex((item) => item.key === "finance") + 1)
        return
      }
    }

    if (enabledModules.contract && contractId === "none") {
      setError(t("errorContractRequired"))
      navigate(steps.findIndex((item) => item.key === "setup") + 1)
      return
    }

    if (enabledModules.photos && requirements.length === 0) {
      setError(t("errorRequirementsRequired"))
      navigate(steps.findIndex((item) => item.key === "setup") + 1)
      return
    }

    if (customFields.length > 0 && contractId === "none") {
      setError(t("errorCustomFieldsContract"))
      navigate(steps.findIndex((item) => item.key === "setup") + 1)
      return
    }

    if (isBulkMode && (!bulkCsvPreview || bulkCsvPreview.validEmails.length === 0)) {
      setError(t("bulkCsvRequired"))
      navigate(steps.findIndex((item) => item.key === "basics") + 1)
      return
    }

    setIsPending(true)

    try {
      const payload = {
        recreateFromTransactionId,
        title,
        serviceDate,
        notes,
        contractTemplateId:
          enabledModules.contract && contractId !== "none" ? contractId : null,
        checklistTemplateId: enabledModules.photos ? checklistIds[0] ?? null : null,
        amount: enabledModules.payment && amount ? parseEur(amount) : null,
        depositAmount:
          enabledModules.deposit && depositAmount ? parseEur(depositAmount) : null,
        depositHoldDays: enabledModules.deposit && depositNum > 0 ? depositHoldDaysNum : 7,
        depositLongTermFeeAccepted:
          enabledModules.deposit && isLongDeposit && longDepositFeeAccepted,
        requiresKyc: enabledModules.kyc && requiresKyc,
        generateQr: isBulkMode ? false : generateQr,
        paymentCollectionTiming,
        requireClientCompany,
        requirements: (enabledModules.photos ? requirements : []).map((item) => ({
          label: item.label,
          description: item.description || null,
          type: item.type,
          category: item.category,
          customCategoryLabel:
            item.category === "OTHER" ? item.customCategoryLabel || null : null,
          required: item.required,
          requiredFileCount: item.requiredFileCount,
          fileSlotLabels: item.fileSlotLabels,
          exampleImageUrl: item.type === "TEXT" ? null : item.exampleImage?.assetUrl ?? null,
          exampleImagePublicId:
            item.type === "TEXT" ? null : item.exampleImage?.publicId ?? null,
          exampleImageFileName:
            item.type === "TEXT" ? null : item.exampleImage?.fileName ?? null,
        })),
        customFields: (enabledModules.contract ? customFields : []).map((item) => ({
          label: item.label,
          instructions: item.instructions || null,
          type: item.type,
          selectOptions:
            item.type === "SELECT"
              ? item.selectOptions.map((option) => option.trim()).filter(Boolean)
              : [],
        })),
        flowType: enableCheckInOut ? "CHECK_IN_OUT" : "STANDARD",
        reportFields: enableCheckInOut
          ? reportFields.map((item) => ({
              label: item.label,
              instructions: item.instructions || null,
              fieldType: item.fieldType,
              reportType: item.reportType,
              selectOptions:
                item.fieldType === "SELECT"
                  ? item.selectOptions.map((opt) => opt.trim()).filter(Boolean)
                  : [],
            }))
          : [],
        ...(isBulkMode
          ? {
              recipientEmails: bulkCsvPreview?.validEmails ?? [],
              sourceFileName: bulkCsvPreview?.fileName ?? null,
            }
          : {}),
      }
      const response = await fetch(isBulkMode ? "/api/vendor/transactions/bulk" : "/api/vendor/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || t("errorCreate"))
        return
      }

      if (isBulkMode) {
        setBulkSuccess({ batch: data.batch, rows: data.rows ?? [] })
        setSuccessRecord(null)
        setSuccessError(null)
        setSuccessLink(null)
        skipPendingCleanupRef.current = true
        onUsageUpdated?.(data.actionUsage ?? null)
        return
      }

      const link = data.linkRecord?.shareLink || (data.link?.token ? `${window.location.origin}/t/${data.link.token}` : "")
      setSuccessRecord(data.linkRecord ?? null)
      setSuccessError(null)
      setSuccessLink(link)
      skipPendingCleanupRef.current = true

      if (onLinkCreated && data.linkRecord) {
        onLinkCreated(data.linkRecord, data.actionUsage ?? null)
      }
      onUsageUpdated?.(data.actionUsage ?? null)
    } catch {
      setError(t("errorUnexpected"))
    } finally {
      setIsPending(false)
    }
  }

  function handleCopy() {
    if (!successLink) return
    void navigator.clipboard
      .writeText(successLink)
      .then(() => {
        setSuccessError(null)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        setSuccessError(t("shareCopyError"))
      })
  }

  function handleReset() {
    const nextInitialState = createInitialFormState(initialValues)
    skipPendingCleanupRef.current = false
    pendingLocalAssetsRef.current = []
    setSuccessLink(null)
    setSuccessRecord(null)
    setBulkSuccess(null)
    setSuccessError(null)
    setCopied(false)
    setBulkCsvPreview(null)
    setEnabledModules(nextInitialState.enabledModules)
    setTitle(nextInitialState.title)
    setNotes(nextInitialState.notes)
    setContractId(nextInitialState.contractId)
    setChecklistIds(nextInitialState.checklistIds)
    setAmount(nextInitialState.amount)
    setDepositAmount(nextInitialState.depositAmount)
    setDepositHoldDays(nextInitialState.depositHoldDays)
    setServiceDate(nextInitialState.serviceDate)
    setLongDepositFeeAccepted(false)
    setRequiresKyc(nextInitialState.requiresKyc)
    setGenerateQr(nextInitialState.generateQr)
    setPaymentCollectionTiming(nextInitialState.paymentCollectionTiming)
    setRequireClientCompany(nextInitialState.requireClientCompany)
    setRequirements(nextInitialState.requirements)
    setCustomFields(nextInitialState.customFields)
    setEnableCheckInOut(nextInitialState.flowType === "CHECK_IN_OUT")
    setReportFields(nextInitialState.reportFields)
    setStepError(null)
    setError(null)
    setStep(1)
  }

  function openSharePopup(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=760")
  }

  function getSuccessShareLink() {
    return successRecord?.shareLink ?? successLink ?? ""
  }

  function getSuccessShareTitle() {
    return successRecord?.title?.trim() || title.trim() || t("successDefaultTitle")
  }

  function buildShareMessage(link: string) {
    return t("shareMessage", {
      title: getSuccessShareTitle(),
      link,
    })
  }

  function handleShareWhatsApp() {
    const link = getSuccessShareLink()
    if (!link) return

    setSuccessError(null)
    openSharePopup(`https://wa.me/?text=${encodeURIComponent(buildShareMessage(link))}`)
  }

  function handleShareFacebook() {
    const link = getSuccessShareLink()
    if (!link) return

    setSuccessError(null)
    openSharePopup(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(
        buildShareMessage(link)
      )}`
    )
  }

  function handleShareEmail() {
    const link = getSuccessShareLink()
    if (!link) return

    setSuccessError(null)
    window.location.href = `mailto:?subject=${encodeURIComponent(
      t("shareEmailSubject", { title: getSuccessShareTitle() })
    )}&body=${encodeURIComponent(buildShareMessage(link))}`
  }

  function handleOpenSecureLink() {
    const link = getSuccessShareLink()
    if (!link) return

    setSuccessError(null)
    window.open(link, "_blank", "noopener,noreferrer")
  }

  function handleCopyBulkLinks() {
    if (!bulkSuccess || bulkSuccess.rows.length === 0) return

    const text = bulkSuccess.rows
      .map((row) => `${row.email}, ${row.reference}, ${row.secureLink}`)
      .join("\n")

    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setSuccessError(null)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        setSuccessError(t("shareCopyError"))
      })
  }

  function getQrCanvasElement() {
    return qrCanvasContainerRef.current?.querySelector("canvas") ?? null
  }

  function getQrImageFileName() {
    const base =
      successRecord?.reference?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
      "secure-link"

    return `${base}-qr.png`
  }

  async function createQrImageFile() {
    const canvas = getQrCanvasElement()

    if (!canvas) {
      return null
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), "image/png")
    })

    if (!blob) {
      return null
    }

    return new File([blob], getQrImageFileName(), { type: "image/png" })
  }

  async function handleDownloadQrImage() {
    setSuccessError(null)
    setIsDownloadingQrImage(true)

    try {
      const file = await createQrImageFile()

      if (!file) {
        setSuccessError(t("shareQrImageError"))
        return
      }

      const url = URL.createObjectURL(file)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = file.name
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloadingQrImage(false)
    }
  }

  async function handleShareQrImage() {
    const link = getSuccessShareLink()

    if (!link || typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return
    }

    setSuccessError(null)
    setIsSharingQrImage(true)

    try {
      const file = await createQrImageFile()

      if (!file) {
        setSuccessError(t("shareQrImageError"))
        return
      }

      const payload = {
        title: t("shareQrImageTitle", { title: getSuccessShareTitle() }),
        text: t("shareQrImageText", { link }),
        files: [file],
      }

      if (typeof navigator.canShare === "function" && !navigator.canShare(payload)) {
        setSuccessError(t("shareQrImageUnsupported"))
        return
      }

      await navigator.share(payload)
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return
      }

      setSuccessError(t("shareQrImageError"))
    } finally {
      setIsSharingQrImage(false)
    }
  }

  if (bulkSuccess) {
    const previewRows = bulkSuccess.rows.slice(0, 12)

    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8">
          <div className="mx-auto w-full max-w-4xl">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-sm border border-[var(--contrazy-teal)]/35 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                <CheckCircle2 className="size-6" />
              </div>
              <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{t("bulkSuccessTitle")}</h1>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("bulkSuccessDesc", {
                  sent: bulkSuccess.batch.sentCount,
                  failed: bulkSuccess.batch.failedCount,
                  total: bulkSuccess.batch.recipientCount,
                })}
              </p>
            </div>

            <section className="mt-8 rounded-sm border border-border bg-muted/10 p-4 text-left">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("bulkResultTitle")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("bulkResultDesc")}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(buttonSecondaryClass, "cursor-pointer")}
                  onClick={handleCopyBulkLinks}
                >
                  <Copy className="mr-2 size-4" />
                  {copied ? t("copied") : t("bulkCopyAll")}
                </Button>
              </div>

              <div className="mt-4 overflow-hidden rounded-sm border border-border bg-background">
                <div className="grid grid-cols-[minmax(0,1fr)_130px_120px] gap-3 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>{t("bulkColumnEmail")}</span>
                  <span>{t("bulkColumnReference")}</span>
                  <span>{t("bulkColumnStatus")}</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {previewRows.map((row) => (
                    <div
                      key={`${row.reference}-${row.email}`}
                      className="grid grid-cols-[minmax(0,1fr)_130px_120px] gap-3 border-b border-border px-3 py-2 text-xs last:border-b-0"
                    >
                      <span className="truncate text-foreground" title={row.email}>{row.email}</span>
                      <span className="font-medium text-foreground">{row.reference}</span>
                      <span className={row.deliveryStatus === "EMAIL_SENT" ? "text-emerald-700" : "text-amber-700"}>
                        {row.deliveryStatus === "EMAIL_SENT" ? t("bulkStatusSent") : t("bulkStatusFailed")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {bulkSuccess.rows.length > previewRows.length ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("bulkRowsHidden", { count: bulkSuccess.rows.length - previewRows.length })}
                </p>
              ) : null}

              {successError ? (
                <div className="mt-4 flex items-start gap-2 rounded-sm border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <p>{successError}</p>
                </div>
              ) : null}
            </section>

            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className={cn(buttonSecondaryClass, "cursor-pointer")}
                onClick={handleReset}
              >
                {t("createAnother")}
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (successLink) {
    const shareLink = getSuccessShareLink()
    const shareTitle = getSuccessShareTitle()
    const canShareQrImage = typeof navigator !== "undefined" && typeof navigator.share === "function"

    return (
      <div className="flex h-full min-h-0 flex-col bg-background">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-8">
          <div className="mx-auto w-full max-w-4xl">
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-sm border border-[var(--contrazy-teal)]/35 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
              <CheckCircle2 className="size-6" />
              </div>
              <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{t("successTitle")}</h1>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {generateQr ? t("successDescWithQr") : t("successDescNoQr")}
              </p>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <section className="rounded-sm border border-border bg-muted/10 p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t("sharePanelTitle")}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("sharePanelDesc")}</p>
                  </div>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {successRecord?.reference ?? shareTitle}
                  </span>
                </div>

                <div className="mt-4">
                  <Label htmlFor="generated-link" className={fieldLabelClass}>
                    {t("secureLinkLabel")}
                  </Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <Input
                      id="generated-link"
                      readOnly
                      value={shareLink}
                      className={cn(controlClass, "bg-background text-xs")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(buttonSecondaryClass, "cursor-pointer")}
                      onClick={handleCopy}
                    >
                      <Copy className="mr-2 size-4" />
                      {copied ? t("copied") : t("copyLink")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(buttonSecondaryClass, "cursor-pointer")}
                      onClick={handleOpenSecureLink}
                    >
                      <ExternalLink className="mr-2 size-4" />
                      {t("openLink")}
                    </Button>
                  </div>
                </div>

                <div className="mt-5">
                  <p className={fieldLabelClass}>{t("shareChannelsTitle")}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(buttonSecondaryClass, "justify-start cursor-pointer")}
                      onClick={handleShareWhatsApp}
                    >
                      <MessageCircle className="mr-2 size-4" />
                      {t("shareWhatsApp")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(buttonSecondaryClass, "justify-start cursor-pointer")}
                      onClick={handleShareFacebook}
                    >
                      <Share2 className="mr-2 size-4" />
                      {t("shareFacebook")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(buttonSecondaryClass, "justify-start cursor-pointer")}
                      onClick={handleShareEmail}
                    >
                      <Mail className="mr-2 size-4" />
                      {t("shareEmail")}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("shareChannelsHint")}</p>
                </div>

                {successError ? (
                  <div className="mt-4 flex items-start gap-2 rounded-sm border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    <p>{successError}</p>
                  </div>
                ) : null}
              </section>

              {generateQr ? (
                <aside className="rounded-sm border border-border bg-background p-4">
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">{t("qrPanelTitle")}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("qrPanelDesc")}</p>
                  </div>

                  <div
                    ref={qrCanvasContainerRef}
                    className="mt-4 flex justify-center rounded-sm border border-border bg-white p-4"
                  >
                    <QRCodeCanvas value={shareLink} size={176} level="M" includeMargin />
                  </div>

                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <QrCode className="size-3.5" />
                    {t("qrReadyLabel")}
                  </p>

                  <div className="mt-4 grid gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(buttonSecondaryClass, "justify-start cursor-pointer")}
                      onClick={handleDownloadQrImage}
                      disabled={isDownloadingQrImage || isSharingQrImage}
                    >
                      {isDownloadingQrImage ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 size-4" />
                      )}
                      {t("downloadQrImage")}
                    </Button>

                    {canShareQrImage ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(buttonSecondaryClass, "justify-start cursor-pointer")}
                        onClick={handleShareQrImage}
                        disabled={isDownloadingQrImage || isSharingQrImage}
                      >
                        {isSharingQrImage ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Share2 className="mr-2 size-4" />
                        )}
                        {t("shareQrImage")}
                      </Button>
                    ) : null}
                  </div>
                </aside>
              ) : (
                <aside className="flex items-start gap-3 rounded-sm border border-dashed border-border bg-muted/20 p-4 text-left">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("qrNotGenerated")}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("qrNotGeneratedDesc")}</p>
                  </div>
                </aside>
              )}
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className={cn(buttonSecondaryClass, "cursor-pointer")}
                onClick={handleReset}
              >
                {t("createAnother")}
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <WizardStepper current={step} steps={steps} />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          <motion.main
            key={step}
            variants={stepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-5"
          >
            <StepHeader step={activeStep} />

            {activeStep?.key === "modules" ? (
              <div>
                {recreateSourceReference ? (
                  <Section>
                    <InlineNotice>
                      {t("recreateNotice", { reference: recreateSourceReference })}
                    </InlineNotice>
                  </Section>
                ) : null}

                <Section>
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-[var(--contrazy-teal)]/25 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                      <ClipboardList className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t("modulesTitle")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("modulesDesc")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <ModuleCard
                      icon={ShieldCheck}
                      title={t("moduleKycTitle")}
                      description={t("moduleKycDesc")}
                      checked={enabledModules.kyc}
                      note={t("moduleStripeRequiredNote")}
                      onToggle={() => setWorkflowModuleEnabled("kyc", !enabledModules.kyc)}
                    />
                    <ModuleCard
                      icon={FileText}
                      title={t("moduleContractTitle")}
                      description={t("moduleContractDesc")}
                      checked={enabledModules.contract}
                      onToggle={() =>
                        setWorkflowModuleEnabled("contract", !enabledModules.contract)
                      }
                    />
                    <ModuleCard
                      icon={ClipboardList}
                      title={t("modulePhotosTitle")}
                      description={t("modulePhotosDesc")}
                      checked={enabledModules.photos}
                      onToggle={() => setWorkflowModuleEnabled("photos", !enabledModules.photos)}
                    />
                    <ModuleCard
                      icon={Wallet}
                      title={t("moduleDepositTitle")}
                      description={t("moduleDepositDesc")}
                      checked={enabledModules.deposit}
                      note={t("moduleStripeRequiredNote")}
                      onToggle={() =>
                        setWorkflowModuleEnabled("deposit", !enabledModules.deposit)
                      }
                    />
                    <ModuleCard
                      icon={CreditCard}
                      title={t("modulePaymentTitle")}
                      description={t("modulePaymentDesc")}
                      checked={enabledModules.payment}
                      note={t("moduleStripeRequiredNote")}
                      onToggle={() =>
                        setWorkflowModuleEnabled("payment", !enabledModules.payment)
                      }
                    />
                  </div>

                  {!hasAnyWorkflowModuleSelected(enabledModules) ? (
                    <div className="mt-4">
                      <InlineNotice tone="warning" icon={AlertCircle}>
                        {t("errorNoModules")}
                      </InlineNotice>
                    </div>
                  ) : null}

                  {stripeSelectionNotice ? (
                    <div className="mt-4">
                      <InlineNotice>
                        {t("stripeRequired")}{" "}
                        <Link
                          href="/vendor/stripe"
                          className="font-semibold underline underline-offset-2"
                        >
                          {t("connectStripe")} →
                        </Link>
                      </InlineNotice>
                    </div>
                  ) : null}
                </Section>

                <Section>
                  <InlineNotice>
                    {t("modulesPreview", {
                      count: Object.values(enabledModules).filter(Boolean).length,
                    })}
                  </InlineNotice>
                </Section>
              </div>
            ) : null}

            {activeStep?.key === "basics" ? (
              <div>
                {!canLaunch ? (
                  <Section>
                    <InlineNotice tone="warning" icon={AlertCircle}>
                      {blockedMessage}
                    </InlineNotice>
                  </Section>
                ) : null}

                <Section>
                  <Field id="title" label={t("titleLabel")} required>
                    <Input
                      id="title"
                      placeholder={t("titlePlaceholder")}
                      maxLength={INPUT_LIMITS.transactionTitle}
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value)
                        setStepError(null)
                      }}
                      autoFocus
                      className={controlClass}
                    />
                  </Field>
                </Section>

                <Section>
                  <Field
                    id="notes"
                    label={t("notesLabel")}
                    hint={
                      <div className="flex items-center justify-between gap-3">
                        <span>{t("notesPrivate")}</span>
                        <CharacterCount current={notes.length} limit={INPUT_LIMITS.transactionNotes} />
                      </div>
                    }
                  >
                    <Textarea
                      id="notes"
                      placeholder={t("notesPlaceholder")}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      maxLength={INPUT_LIMITS.transactionNotes}
                      className={textareaClass}
                    />
                  </Field>
                </Section>

                <Section>
                  <Field id="serviceDate" label={t("serviceDateLabel")} required>
                    <Input
                      id="serviceDate"
                      type="date"
                      value={serviceDate}
                      onChange={(event) => {
                        setServiceDate(event.target.value)
                        setStepError(null)
                      }}
                      className={controlClass}
                    />
                  </Field>
                </Section>

                {isBulkMode ? (
                  <Section>
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-[var(--contrazy-teal)]/25 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                        <Users className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{t("bulkCsvTitle")}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("bulkCsvDesc")}</p>

                        <div className="mt-4 rounded-sm border border-dashed border-border bg-muted/20 p-4">
                          <Label
                            htmlFor="bulk-csv-file"
                            className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm border border-border bg-background px-3 text-sm font-medium text-foreground shadow-none transition hover:bg-muted"
                          >
                            <Upload className="size-4" />
                            {t("bulkCsvChoose")}
                          </Label>
                          <Input
                            id="bulk-csv-file"
                            type="file"
                            accept=".csv,text/csv"
                            className="sr-only"
                            onChange={(event) => {
                              void handleBulkCsvFile(event.target.files?.[0] ?? null)
                              event.target.value = ""
                            }}
                          />

                          {bulkCsvPreview ? (
                            <div className="mt-4 rounded-sm border border-border bg-background p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{bulkCsvPreview.fileName}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {t("bulkCsvStats", {
                                      count: bulkCsvPreview.validEmails.length,
                                      duplicates: bulkCsvPreview.duplicateCount,
                                      skipped: bulkCsvPreview.rowsWithoutEmail,
                                    })}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 cursor-pointer rounded-sm text-muted-foreground hover:text-foreground"
                                  onClick={clearBulkCsv}
                                >
                                  {t("bulkCsvClear")}
                                </Button>
                              </div>

                              {bulkCsvPreview.validEmails.length > 0 ? (
                                <div className="mt-3 max-h-28 overflow-y-auto rounded-sm border border-border bg-muted/20 p-2 text-xs text-muted-foreground">
                                  {bulkCsvPreview.validEmails.slice(0, 20).map((email) => (
                                    <span
                                      key={email}
                                      className="mr-1.5 mb-1.5 inline-flex rounded-full border border-border bg-background px-2 py-0.5"
                                    >
                                      {email}
                                    </span>
                                  ))}
                                  {bulkCsvPreview.validEmails.length > 20 ? (
                                    <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5">
                                      {t("bulkCsvMore", {
                                        count: bulkCsvPreview.validEmails.length - 20,
                                      })}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Section>
                ) : null}

                <Section>
                  <SwitchRow
                    id="require-client-company"
                    icon={Building2}
                    title={t("requireCompanyTitle")}
                    description={t("requireCompanyDesc")}
                    checked={requireClientCompany}
                    onCheckedChange={setRequireClientCompany}
                  />

                  <SwitchRow
                    id="enable-checkinout"
                    icon={Clock3}
                    title={t("checkInOutTitle")}
                    description={t("checkInOutDesc")}
                    checked={enableCheckInOut}
                    onCheckedChange={(checked) => setEnableCheckInOut(Boolean(checked))}
                    disabled={isBulkMode}
                  >
                    {isBulkMode ? (
                      <p className="mt-1 text-xs text-muted-foreground">{t("checkInOutBulkDisabled")}</p>
                    ) : null}
                  </SwitchRow>
                </Section>
              </div>
            ) : null}

            {activeStep?.key === "finance" ? (
              <div>
                <Section>
                  {stripeSelectionNotice ? (
                    <div className="mb-3">
                      <InlineNotice>
                        {t("stripeRequired")}{" "}
                        <Link
                          href="/vendor/stripe"
                          className="font-semibold underline underline-offset-2"
                        >
                          {t("connectStripe")} →
                        </Link>
                      </InlineNotice>
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {enabledModules.deposit ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{t("depositTitle")}</p>
                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t("depositDesc")}</p>
                          </div>
                        </div>

                        <Field id="depositAmount" label={t("depositHoldLabel")} required>
                          <Input
                            id="depositAmount"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={depositAmount}
                            onChange={(event) => {
                              setDepositAmount(event.target.value)
                              setLongDepositFeeAccepted(false)
                              setStepError(null)
                            }}
                            disabled={financeDisabled}
                            className={controlClass}
                          />
                        </Field>

                        {depositNum > 0 ? (
                          <div className="space-y-2 rounded-sm border border-border bg-muted/20 p-3">
                            <Field id="depositHoldDays" label={t("depositDurationLabel")}>
                              <Input
                                id="depositHoldDays"
                                type="number"
                                min="7"
                                max="30"
                                step="1"
                                value={canChooseLongDeposit ? depositHoldDays : "7"}
                                onChange={(event) => {
                                  const raw = event.target.value
                                  const cleaned = raw.replace(/[^0-9]/g, "")
                                  setDepositHoldDays(
                                    cleaned === "" ? "" : String(parseInt(cleaned, 10))
                                  )
                                  setLongDepositFeeAccepted(false)
                                  setStepError(null)
                                }}
                                onBlur={(event) => {
                                  if (!canChooseLongDeposit) return
                                  const val = parseInt(event.target.value, 10)
                                  if (isNaN(val) || val < 7) {
                                    setDepositHoldDays("7")
                                  } else if (val > 30) {
                                    setDepositHoldDays("30")
                                  } else {
                                    setDepositHoldDays(String(val))
                                  }
                                }}
                                disabled={financeDisabled || !canChooseLongDeposit}
                                className={`${controlClass} ${depositDaysInvalid ? "border-destructive ring-destructive/20" : ""}`}
                              />
                            </Field>

                            {!canChooseLongDeposit ? (
                              <p className="text-xs leading-5 text-muted-foreground">
                                {t("depositDurationStarterLocked")}
                              </p>
                            ) : depositDaysInvalid ? (
                              <p className="text-xs leading-5 text-destructive">
                                {t("errorDepositDuration")}
                              </p>
                            ) : (
                              <p className="text-xs leading-5 text-muted-foreground">
                                {t("depositDurationChoiceHint")}
                              </p>
                            )}

                            {isLongDeposit && depositPricing ? (
                              <div className="space-y-3 rounded-sm border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                                  <p className="leading-5 font-medium">
                                    {t("longDepositWarning", {
                                      days: depositHoldDaysNum,
                                      totalFee: `€${depositPricing.total.toFixed(2)}`,
                                    })}
                                  </p>
                                </div>
                                <label className="flex cursor-pointer items-start gap-2 pl-5 text-xs font-medium leading-5 text-destructive">
                                  <input
                                    type="checkbox"
                                    checked={longDepositFeeAccepted}
                                    onChange={(event) => {
                                      setLongDepositFeeAccepted(event.target.checked)
                                      setStepError(null)
                                    }}
                                    className="mt-1 size-3.5 cursor-pointer accent-red-600"
                                  />
                                  <span>{t("longDepositAcceptLabel")}</span>
                                </label>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {depositNum > 0 ? (
                          <dl className="space-y-1 border-t border-border pt-2 text-xs">
                            <div className="flex justify-between gap-3">
                              <dt className="text-muted-foreground">{t("holdAmount")}</dt>
                              <dd className="font-medium text-foreground">€{depositNum.toFixed(2)}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-muted-foreground">{t("vendorFeeEstimate")}</dt>
                              <dd>€{depositPricing?.total.toFixed(2)}</dd>
                            </div>
                            <div className="border-t border-border pt-1.5 text-muted-foreground">
                              {isLongDeposit ? t("longDepositFeeSummary") : t("noFeesUnlessCaptured")}
                            </div>
                          </dl>
                        ) : null}
                      </div>
                    ) : null}

                    {enabledModules.payment ? (
                      <div
                        className={cn(
                          "space-y-3",
                          enabledModules.deposit &&
                            "border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <CreditCard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{t("servicePaymentTitle")}</p>
                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t("servicePaymentDesc")}</p>
                          </div>
                        </div>

                        <Field id="amount" label={t("amountLabel")} required>
                          <Input
                            id="amount"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={amount}
                            onChange={(event) => {
                              setAmount(event.target.value)
                              setStepError(null)
                            }}
                            disabled={financeDisabled}
                            className={controlClass}
                          />
                        </Field>

                        {amountNum > 0 ? (
                          <>
                            <p className="border-t border-border pt-2 text-xs leading-5 text-muted-foreground">
                              {t("clientPays", {
                                amount: `€${amountNum.toFixed(2)}`,
                                payout: `€${(amountNum - amountNum * 0.014 - 0.25).toFixed(2)}`,
                              })}
                            </p>

                            <div className="grid gap-3 pt-1">
                              {paymentCollectionTimingOptions.map((option) => {
                                const active = paymentCollectionTiming === option.value
                                const optionId = `payment-timing-${option.value}`

                                return (
                                  <button
                                    key={option.value}
                                    id={optionId}
                                    type="button"
                                    onClick={() => setPaymentCollectionTiming(option.value)}
                                    className={cn(
                                      "cursor-pointer rounded-sm border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0",
                                      active
                                        ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)]/10"
                                        : "border-border bg-background hover:bg-muted/35"
                                    )}
                                  >
                                    <div className="flex items-start gap-2">
                                      <span
                                        className={cn(
                                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                                          active
                                            ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)]"
                                            : "border-border bg-background"
                                        )}
                                      >
                                        {active ? <CheckCircle2 className="size-3 text-white" /> : null}
                                      </span>
                                      <span>
                                        <span className="block text-sm font-medium text-foreground">
                                          {paymentTimingLabels[option.value]?.label ?? option.label}
                                        </span>
                                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                          {paymentTimingLabels[option.value]?.description ?? option.description}
                                        </span>
                                      </span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </Section>

                {amountNum > 0 && paymentCollectionTiming === "AFTER_SERVICE" ? (
                  <Section>
                    <InlineNotice>
                      {t("deferredPaymentNote")}
                    </InlineNotice>
                  </Section>
                ) : null}

                <Section>
                  <div className="flex items-center justify-between gap-3">
                    <span className={fieldLabelClass}>{t("summaryType")}</span>
                    <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                      {kindLabels[txKind]}
                    </span>
                  </div>
                </Section>
              </div>
            ) : null}

            {activeStep?.key === "setup" ? (
              <div>
                {enabledModules.contract && missingSourceContractTemplateName && contractId === "none" ? (
                  <Section>
                    <InlineNotice tone="warning" icon={AlertCircle}>
                      {t("recreateMissingContractWarning", {
                        template: missingSourceContractTemplateName,
                      })}
                    </InlineNotice>
                  </Section>
                ) : null}

                {enabledModules.photos || enabledModules.contract ? (
                  <Section>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {enabledModules.photos ? (
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t("requiredUploads")}
                          </label>
                          {selectedChecklistTemplates.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {selectedChecklistTemplates.map((bundle) => (
                                <span
                                  key={bundle.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground"
                                >
                                  <ClipboardList className="size-3 shrink-0 text-muted-foreground" />
                                  <span className="max-w-[140px] truncate">
                                    {getTemplateLabel(bundle, t("untitledChecklist"))}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={t("removeBundle")}
                                    onClick={() => handleRemoveBundle(bundle.id)}
                                    className="ml-0.5 rounded text-muted-foreground transition-colors hover:text-destructive"
                                  >
                                    <X className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          {checklists.filter((c) => !checklistIds.includes(c.id)).length > 0 ? (
                            <Select
                              onValueChange={(value: string | null) => {
                                if (value) handleAddBundle(value)
                              }}
                            >
                              <SelectTrigger className={cn(controlClass, "cursor-pointer")}>
                                <span className="truncate text-sm text-muted-foreground">
                                  {t("addBundle")}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {checklists
                                  .filter((c) => !checklistIds.includes(c.id))
                                  .map((checklist) => (
                                    <SelectItem
                                      key={checklist.id}
                                      value={checklist.id}
                                      className="cursor-pointer"
                                    >
                                      <span className="block max-w-60 truncate">
                                        {getTemplateLabel(checklist, t("untitledChecklist"))}
                                      </span>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          ) : checklists.length === 0 ? (
                            <span className="text-xs text-muted-foreground">{t("noUploadsNeeded")}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("allBundlesAdded")}</span>
                          )}
                        </div>
                      ) : null}

                      {enabledModules.contract ? (
                        <Field id="contract" label={t("contractTemplate")} required>
                          <Select
                            value={contractId}
                            onValueChange={(value) => setContractId(value ?? "none")}
                          >
                            <SelectTrigger id="contract" className={cn(controlClass, "cursor-pointer")}>
                              <span
                                className={cn(
                                  "truncate text-sm",
                                  contractId === "none" && "text-muted-foreground"
                                )}
                              >
                                {contractLabel}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="cursor-pointer">
                                {t("noContractNeeded")}
                              </SelectItem>
                              {contracts.map((contract) => (
                                <SelectItem key={contract.id} value={contract.id} className="cursor-pointer">
                                  <span className="block max-w-60 truncate">
                                    {getTemplateLabel(contract, t("untitledContract"))}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      ) : null}
                    </div>
                  </Section>
                ) : null}

                {enabledModules.photos ? (
                  <Section>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("perTransactionTitle")}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t("perTransactionDesc")}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(buttonSecondaryClass, "shrink-0 cursor-pointer")}
                      onClick={addRequirement}
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      {t("addRequirement")}
                    </Button>
                  </div>

                  {requirements.length === 0 ? (
                    <div className="border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                      {t("noRequirements")}
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-border">
                      <div className="hidden grid-cols-[2fr_1fr_1fr] border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                        <span>{t("reqLabel")}</span>
                        <span>{t("reqType")}</span>
                        <span>{t("reqCategory")}</span>
                      </div>

                      <div className="divide-y divide-border">
                        {requirements.map((item, index) => {
                          const rowId = item.id
                          const customCategoryDisabled = item.category !== "OTHER"

                          return (
                            <div key={item.id} className="grid gap-3 px-3 py-3 md:grid-cols-[2fr_1fr_1fr]">
                              <div className="space-y-2">
                                <Label htmlFor={`${rowId}-label`} className={fieldLabelClass}>
                                  {t("reqLabel")}
                                </Label>
                                <Input
                                  id={`${rowId}-label`}
                                  value={item.label}
                                  onChange={(event) => updateRequirement(item.id, { label: event.target.value })}
                                  placeholder={t("reqLabelPlaceholder")}
                                  maxLength={INPUT_LIMITS.checklistItemLabel}
                                  className={controlClass}
                                />

                                <Label htmlFor={`${rowId}-description`} className={fieldLabelClass}>
                                  {t("reqInstructions")}
                                </Label>
                                <Textarea
                                  id={`${rowId}-description`}
                                  value={item.description}
                                  onChange={(event) => updateRequirement(item.id, { description: event.target.value })}
                                  placeholder={item.type === "TEXT" ? t("reqTextPlaceholder") : t("reqUploadPlaceholder")}
                                  maxLength={INPUT_LIMITS.checklistItemInstructions}
                                  className="min-h-[54px] resize-none rounded-sm border-border shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"
                                />
                                <CharacterCount
                                  current={item.description.length}
                                  limit={INPUT_LIMITS.checklistItemInstructions}
                                  className="text-right"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`${rowId}-type`} className={fieldLabelClass}>
                                  {t("reqType")}
                                </Label>
                                <Select
                                  value={item.type}
                                  onValueChange={(value) => void handleRequirementTypeChange(item.id, value as RequirementTypeValue)}
                                >
                                  <SelectTrigger id={`${rowId}-type`} className={cn(controlClass, "cursor-pointer")}>
                                    <span className="truncate text-sm">{reqTypeLabels[item.type] ?? t("reqTypeDocument")}</span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {requirementTypeOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                                        {reqTypeLabels[option.value] ?? option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <div className="flex items-center justify-between gap-3 border border-border bg-muted/20 px-3 py-2">
                                  <Label htmlFor={`${rowId}-required`} className="text-xs font-medium text-foreground">
                                    {t("reqRequired")}
                                  </Label>
                                  <Switch
                                    id={`${rowId}-required`}
                                    checked={item.required}
                                    onCheckedChange={(checked) => updateRequirement(item.id, { required: Boolean(checked) })}
                                    className="cursor-pointer data-[state=checked]:bg-[var(--contrazy-teal)]"
                                  />
                                </div>

                                {requirementSupportsFileSlots(item.type) ? (
                                  <div className="space-y-1.5 border border-border bg-muted/20 px-3 py-3">
                                    <Label htmlFor={`${rowId}-file-count`} className={fieldLabelClass}>
                                      {t("reqFileCount")}
                                    </Label>
                                    <Input
                                      id={`${rowId}-file-count`}
                                      type="number"
                                      min="1"
                                      max="5"
                                      step="1"
                                      value={String(item.requiredFileCount)}
                                      onChange={(event) =>
                                        updateRequirementFileCount(item.id, event.target.value)
                                      }
                                      className={controlClass}
                                    />
                                    <p className="text-xs leading-5 text-muted-foreground">
                                      {t("reqFileCountHint")}
                                    </p>
                                  </div>
                                ) : null}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`${rowId}-category`} className={fieldLabelClass}>
                                  {t("reqCategory")}
                                </Label>
                                <Select
                                  value={item.category}
                                  onValueChange={(value) => updateRequirement(item.id, { category: value as RequirementCategoryValue })}
                                >
                                  <SelectTrigger id={`${rowId}-category`} className={cn(controlClass, "cursor-pointer")}>
                                    <span className="truncate text-sm">
                                      {translatedCategoryLabel(item.category, item.customCategoryLabel)}
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {requirementCategoryOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                                        {reqCategoryLabels[option.value] ?? option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <Label htmlFor={`${rowId}-custom-category`} className={fieldLabelClass}>
                                  {t("reqOtherLabel")}
                                </Label>
                                <Input
                                  id={`${rowId}-custom-category`}
                                  value={item.customCategoryLabel}
                                  onChange={(event) => updateRequirement(item.id, { customCategoryLabel: event.target.value })}
                                  placeholder={t("reqCustomPlaceholder")}
                                  maxLength={INPUT_LIMITS.checklistItemLabel}
                                  disabled={customCategoryDisabled}
                                  className={controlClass}
                                />

                                {requirementSupportsFileSlots(item.type) ? (
                                  <div className="space-y-2 border border-border bg-muted/20 px-3 py-3">
                                    <div>
                                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        {t("reqSlotLabels")}
                                      </p>
                                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                                        {t("reqSlotLabelsHint")}
                                      </p>
                                    </div>

                                    {item.fileSlotLabels.map((slotLabel, slotIndex) => (
                                      <div key={`${item.id}-slot-${slotIndex}`} className="space-y-1">
                                        <Label
                                          htmlFor={`${rowId}-slot-${slotIndex}`}
                                          className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                                        >
                                          {t("reqSlotLabel", { index: slotIndex + 1 })}
                                        </Label>
                                        <Input
                                          id={`${rowId}-slot-${slotIndex}`}
                                          value={slotLabel}
                                          onChange={(event) =>
                                            updateRequirementSlotLabel(
                                              item.id,
                                              slotIndex,
                                              event.target.value
                                            )
                                          }
                                          placeholder={t("reqSlotLabelPlaceholder", {
                                            index: slotIndex + 1,
                                          })}
                                          maxLength={INPUT_LIMITS.checklistItemLabel}
                                          className={controlClass}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {item.type !== "TEXT" ? (
                                  <RequirementExampleImageField
                                    value={
                                      item.exampleImage
                                        ? {
                                            assetUrl: item.exampleImage.assetUrl,
                                            fileName: item.exampleImage.fileName,
                                          }
                                        : null
                                    }
                                    uploading={uploadingRequirementIds.includes(item.id)}
                                    disabled={isPending}
                                    onFileSelected={(file) => void handleRequirementExampleUpload(item.id, file)}
                                    onRemove={() => void handleRequirementExampleRemove(item.id)}
                                  />
                                ) : null}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-full cursor-pointer rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => void removeRequirement(item.id)}
                                  aria-label={`Remove requirement ${index + 1}`}
                                >
                                  <Trash2 className="mr-1.5 size-3.5" />
                                  {removeRequirementLabel}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </Section>
                ) : null}

                {enabledModules.contract ? (
                <Section>
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("customFieldsTitle")}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {t("customFieldsDesc")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(buttonSecondaryClass, "shrink-0 cursor-pointer")}
                      onClick={addCustomField}
                      disabled={contractId === "none"}
                    >
                      <Plus className="mr-1.5 size-3.5" />
                      {t("addCustomField")}
                    </Button>
                  </div>

                  {contractId === "none" ? (
                    <div className="mb-3">
                      <InlineNotice tone="warning" icon={AlertCircle}>
                        {t("customFieldsContractRequired")}
                      </InlineNotice>
                    </div>
                  ) : null}

                  {customFields.length === 0 ? (
                    <div className="border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                      {t("noCustomFields")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {customFields.map((item, index) => {
                        const rowId = item.id
                        const selectOptions =
                          item.type === "SELECT"
                            ? item.selectOptions.length > 0
                              ? item.selectOptions
                              : ["", ""]
                            : []

                        return (
                          <div key={item.id} className="border border-border bg-background px-3 py-3">
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.85fr)]">
                              <div className="space-y-2">
                                <Label htmlFor={`${rowId}-custom-label`} className={fieldLabelClass}>
                                  {t("customFieldLabel")}
                                </Label>
                                <Input
                                  id={`${rowId}-custom-label`}
                                  value={item.label}
                                  onChange={(event) => updateCustomField(item.id, { label: event.target.value })}
                                  placeholder={t("customFieldLabelPlaceholder")}
                                  maxLength={INPUT_LIMITS.checklistItemLabel}
                                  className={controlClass}
                                />

                                <Label htmlFor={`${rowId}-custom-instructions`} className={fieldLabelClass}>
                                  {t("customFieldInstructions")}
                                </Label>
                                <Textarea
                                  id={`${rowId}-custom-instructions`}
                                  value={item.instructions}
                                  onChange={(event) => updateCustomField(item.id, { instructions: event.target.value })}
                                  placeholder={t("customFieldInstructionsPlaceholder")}
                                  maxLength={INPUT_LIMITS.checklistItemInstructions}
                                  className="min-h-[54px] resize-none rounded-sm border-border shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"
                                />
                                <CharacterCount
                                  current={item.instructions.length}
                                  limit={INPUT_LIMITS.checklistItemInstructions}
                                  className="text-right"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`${rowId}-custom-type`} className={fieldLabelClass}>
                                  {t("customFieldType")}
                                </Label>
                                <Select
                                  value={item.type}
                                  onValueChange={(value) =>
                                    void handleCustomFieldTypeChange(
                                      item.id,
                                      value as TransactionCustomFieldTypeValue
                                    )
                                  }
                                >
                                  <SelectTrigger
                                    id={`${rowId}-custom-type`}
                                    className={cn(controlClass, "cursor-pointer")}
                                  >
                                    <span className="truncate text-sm">
                                      {customFieldTypeLabels[item.type] ?? t("customFieldTypeText")}
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {transactionCustomFieldTypeOptions.map((option) => (
                                      <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        className="cursor-pointer"
                                      >
                                        {customFieldTypeLabels[option.value] ?? option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <div className="flex items-center justify-between gap-3 border border-border bg-muted/20 px-3 py-2">
                                  <div>
                                    <p className="text-xs font-medium text-foreground">
                                      {t("customFieldRequired")}
                                    </p>
                                    <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                                      {t("customFieldRequiredNote")}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
                                    {t("required")}
                                  </span>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-full cursor-pointer rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => removeCustomField(item.id)}
                                  aria-label={`Remove customer field ${index + 1}`}
                                >
                                  <Trash2 className="mr-1.5 size-3.5" />
                                  {t("removeCustomField")}
                                </Button>
                              </div>
                            </div>

                            {item.type === "SELECT" ? (
                              <div className="mt-3 border-t border-border pt-3">
                                <div className="flex items-center justify-between gap-3">
                                  <Label className={fieldLabelClass}>{t("customFieldOptions")}</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={cn(buttonSecondaryClass, "h-8 cursor-pointer")}
                                    onClick={() => addCustomFieldSelectOption(item.id)}
                                  >
                                    <Plus className="mr-1.5 size-3.5" />
                                    {t("addCustomFieldOption")}
                                  </Button>
                                </div>

                                <div className="mt-2 space-y-2">
                                  {selectOptions.map((option, optionIndex) => (
                                    <div
                                      key={`${item.id}-option-${optionIndex}`}
                                      className="flex items-center gap-2"
                                    >
                                      <Input
                                        value={option}
                                        onChange={(event) =>
                                          updateCustomFieldSelectOption(
                                            item.id,
                                            optionIndex,
                                            event.target.value
                                          )
                                        }
                                        placeholder={t("customFieldOptionPlaceholder", {
                                          index: optionIndex + 1,
                                        })}
                                        maxLength={INPUT_LIMITS.checklistItemLabel}
                                        className={controlClass}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 cursor-pointer rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() =>
                                          removeCustomFieldSelectOption(item.id, optionIndex)
                                        }
                                        aria-label={`Remove option ${optionIndex + 1}`}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Section>
                ) : null}

                {enableCheckInOut ? (
                <Section>
                    <div className="mb-3">
                      <p className="text-sm font-medium text-foreground">{t("checkInOutTitle")}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {t("checkInOutDesc")}
                      </p>
                    </div>
                    <div className="mt-4 space-y-4">
                      {(["CHECK_IN", "CHECK_OUT"] as const).map((phase) => {
                        const phaseFields = reportFields.filter((f) => f.reportType === phase)
                        const phaseLabel = phase === "CHECK_IN" ? t("checkInPhaseLabel") : t("checkOutPhaseLabel")

                        return (
                          <div key={phase} className="rounded-sm border border-border">
                            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {phaseLabel}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn(buttonSecondaryClass, "h-7 cursor-pointer")}
                                onClick={() => addReportField(phase)}
                              >
                                <Plus className="mr-1.5 size-3" />
                                {t("addReportField")}
                              </Button>
                            </div>

                            {phaseFields.length === 0 ? (
                              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                                {t("noReportFields")}
                              </div>
                            ) : (
                              <div className="divide-y divide-border">
                                {phaseFields.map((item, index) => {
                                  const rowId = item.id
                                  const selectOptions =
                                    item.fieldType === "SELECT"
                                      ? item.selectOptions.length > 0
                                        ? item.selectOptions
                                        : ["", ""]
                                      : []

                                  return (
                                    <div key={item.id} className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(0,1.45fr)_minmax(200px,0.75fr)]">
                                      <div className="space-y-2">
                                        <Label htmlFor={`${rowId}-rf-label`} className={fieldLabelClass}>
                                          {t("reportFieldLabel")}
                                        </Label>
                                        <Input
                                          id={`${rowId}-rf-label`}
                                          value={item.label}
                                          onChange={(event) => updateReportField(item.id, { label: event.target.value })}
                                          placeholder={t("reportFieldLabelPlaceholder")}
                                          maxLength={INPUT_LIMITS.checklistItemLabel}
                                          className={controlClass}
                                        />

                                        <Label htmlFor={`${rowId}-rf-instructions`} className={fieldLabelClass}>
                                          {t("reportFieldInstructions")}
                                        </Label>
                                        <Textarea
                                          id={`${rowId}-rf-instructions`}
                                          value={item.instructions}
                                          onChange={(event) => updateReportField(item.id, { instructions: event.target.value })}
                                          placeholder={t("reportFieldInstructionsPlaceholder")}
                                          maxLength={INPUT_LIMITS.checklistItemInstructions}
                                          className="min-h-[54px] resize-none rounded-sm border-border shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"
                                        />
                                        <CharacterCount
                                          current={item.instructions.length}
                                          limit={INPUT_LIMITS.checklistItemInstructions}
                                          className="text-right"
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor={`${rowId}-rf-type`} className={fieldLabelClass}>
                                          {t("reportFieldType")}
                                        </Label>
                                        <Select
                                          value={item.fieldType}
                                          onValueChange={(value) =>
                                            handleReportFieldTypeChange(item.id, value as TransactionCustomFieldTypeValue)
                                          }
                                        >
                                          <SelectTrigger id={`${rowId}-rf-type`} className={cn(controlClass, "cursor-pointer")}>
                                            <span className="truncate text-sm">
                                              {customFieldTypeLabels[item.fieldType] ?? t("customFieldTypeText")}
                                            </span>
                                          </SelectTrigger>
                                          <SelectContent>
                                            {transactionCustomFieldTypeOptions.map((option) => (
                                              <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                                                {customFieldTypeLabels[option.value] ?? option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>

                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-full cursor-pointer rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                                          onClick={() => removeReportField(item.id)}
                                          aria-label={`Remove report field ${index + 1}`}
                                        >
                                          <Trash2 className="mr-1.5 size-3.5" />
                                          {t("removeReportField")}
                                        </Button>
                                      </div>

                                      {item.fieldType === "SELECT" ? (
                                        <div className="col-span-full mt-1 border-t border-border pt-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <Label className={fieldLabelClass}>{t("customFieldOptions")}</Label>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className={cn(buttonSecondaryClass, "h-8 cursor-pointer")}
                                              onClick={() => addReportFieldSelectOption(item.id)}
                                            >
                                              <Plus className="mr-1.5 size-3.5" />
                                              {t("addCustomFieldOption")}
                                            </Button>
                                          </div>
                                          <div className="mt-2 space-y-2">
                                            {selectOptions.map((option, optionIndex) => (
                                              <div key={`${item.id}-opt-${optionIndex}`} className="flex items-center gap-2">
                                                <Input
                                                  value={option}
                                                  onChange={(event) =>
                                                    updateReportFieldSelectOption(item.id, optionIndex, event.target.value)
                                                  }
                                                  placeholder={t("customFieldOptionPlaceholder", { index: optionIndex + 1 })}
                                                  maxLength={INPUT_LIMITS.checklistItemLabel}
                                                  className={controlClass}
                                                />
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-9 w-9 cursor-pointer rounded-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                  onClick={() => removeReportFieldSelectOption(item.id, optionIndex)}
                                                  aria-label={`Remove option ${optionIndex + 1}`}
                                                >
                                                  <Trash2 className="size-4" />
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                </Section>
                ) : null}

                {enabledModules.kyc ? (
                  <Section className="space-y-3">
                    <InlineNotice icon={ShieldCheck}>
                      {t("requireIdDesc")}
                    </InlineNotice>

                    {!canUseKycInPlan ? (
                      <InlineNotice tone="warning" icon={AlertCircle}>
                        {t("kycPlanRequired")}
                      </InlineNotice>
                    ) : remainingKyc !== null && remainingKyc <= 0 ? (
                      <InlineNotice tone="warning" icon={AlertCircle}>
                        {t("kycQuotaUsed")}
                      </InlineNotice>
                    ) : remainingKyc !== null ? (
                      <InlineNotice>
                        {remainingKyc === 1 ? t("kycRemainingOne") : t("kycRemainingMany", { count: remainingKyc })}
                      </InlineNotice>
                    ) : null}

                    {stripeSelectionNotice ? (
                      <InlineNotice>
                        {t("stripeRequired")}{" "}
                        <Link
                          href="/vendor/stripe"
                          className="font-semibold underline underline-offset-2"
                        >
                          {t("connectStripe")} →
                        </Link>
                      </InlineNotice>
                    ) : null}

                    <InlineNotice tone="warning" icon={AlertCircle}>
                      {t("kycNote")}
                    </InlineNotice>
                  </Section>
                ) : null}
              </div>
            ) : null}

            {activeStep?.key === "review" ? (
              <div>
                <Section>
                  <div className="grid gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(220px,0.75fr)]">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{t("summaryTitle")}</h3>
                      <dl className="mt-3 text-sm">
                        <div className="flex items-start justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryTitleRow")}</dt>
                          <dd className="max-w-[240px] truncate text-right font-medium text-foreground">{title || "—"}</dd>
                        </div>

                        {isBulkMode ? (
                          <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                            <dt className="text-muted-foreground">{t("summaryRecipients")}</dt>
                            <dd className="font-medium text-foreground">
                              {bulkCsvPreview
                                ? t("summaryRecipientsCount", { count: bulkCsvPreview.validEmails.length })
                                : "—"}
                            </dd>
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryType")}</dt>
                          <dd className="font-medium text-foreground">{kindLabels[txKind]}</dd>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryServiceDate")}</dt>
                          <dd className="font-medium text-foreground">{serviceDate || "—"}</dd>
                        </div>

                        {depositNum > 0 ? (
                          <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                            <dt className="text-muted-foreground">{t("summaryDeposit")}</dt>
                            <dd className="font-medium text-foreground">€{depositNum.toFixed(2)}</dd>
                          </div>
                        ) : null}

                        {depositNum > 0 ? (
                          <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                            <dt className="text-muted-foreground">{t("summaryDepositDuration")}</dt>
                            <dd className="font-medium text-foreground">
                              {t("summaryDepositDurationDays", { count: depositHoldDaysNum })}
                            </dd>
                          </div>
                        ) : null}

                        {amountNum > 0 ? (
                          <>
                            <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                              <dt className="text-muted-foreground">{t("summaryService")}</dt>
                              <dd className="font-medium text-foreground">€{amountNum.toFixed(2)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                              <dt className="text-muted-foreground">{t("summaryTiming")}</dt>
                              <dd className="max-w-[240px] truncate text-right font-medium text-foreground">
                                {paymentTimingLabels[paymentCollectionTiming]?.label ?? t("paymentTimingAfterSigningLabel")}
                              </dd>
                            </div>
                          </>
                        ) : null}

                        <div className="flex items-start justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryBundles")}</dt>
                          <dd className="max-w-[220px] text-right font-medium text-foreground">
                            {selectedChecklistTemplates.length === 0
                              ? <span className="text-muted-foreground font-normal">{t("noUploads")}</span>
                              : selectedChecklistTemplates.map((b) => (
                                  <div key={b.id} className="truncate">{getTemplateLabel(b, t("untitledChecklist"))}</div>
                                ))}
                          </dd>
                        </div>

                        <div className="flex items-start justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryContract")}</dt>
                          <dd className="max-w-[220px] truncate text-right font-medium text-foreground">{contractLabel}</dd>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryRequirements")}</dt>
                          <dd className="font-medium text-foreground">
                            {requirements.length === 0
                              ? t("noRequirements")
                              : requirements.length === 1
                                ? t("summaryRequirementsOne")
                                : t("summaryRequirementsMany", { count: requirements.length })}
                          </dd>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryCustomFields")}</dt>
                          <dd className="font-medium text-foreground">
                            {customFields.length === 0
                              ? t("noCustomFieldsShort")
                              : customFields.length === 1
                                ? t("summaryCustomFieldsOne")
                                : t("summaryCustomFieldsMany", { count: customFields.length })}
                          </dd>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryIdVerification")}</dt>
                          <dd className={cn("font-medium", requiresKyc ? "text-foreground" : "text-muted-foreground")}>
                            {requiresKyc ? t("required") : t("notRequired")}
                          </dd>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryCompanyName")}</dt>
                          <dd className={cn("font-medium", requireClientCompany ? "text-foreground" : "text-muted-foreground")}>
                            {requireClientCompany ? t("required") : t("optional")}
                          </dd>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryFlowType")}</dt>
                          <dd className={cn("font-medium", enableCheckInOut ? "text-foreground" : "text-muted-foreground")}>
                            {enableCheckInOut
                              ? t("summaryFlowTypeCheckInOut", {
                                  count: reportFields.length,
                                })
                              : t("summaryFlowTypeStandard")}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <aside>
                      <h3 className="text-sm font-semibold text-foreground">{t("clientJourney")}</h3>
                      <ol className="relative mt-3 space-y-3 border-l border-border pl-4">
                        {clientSteps.map((clientStep, index) => (
                          <li key={clientStep.key} className="relative">
                            <span className="absolute -left-[21px] top-1 flex size-2.5 rounded-full bg-[var(--contrazy-teal)] ring-4 ring-background" />
                            <p className="text-sm font-medium text-foreground">{clientStep.label}</p>
                            <p className="text-xs text-muted-foreground">{index + 1}</p>
                          </li>
                        ))}
                      </ol>

                      {amountNum > 0 && paymentCollectionTiming === "AFTER_SERVICE" ? (
                        <p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                          {t("deferredPaymentNote")}
                        </p>
                      ) : null}
                    </aside>
                  </div>
                </Section>

                {isBulkMode ? (
                  <Section>
                    <InlineNotice icon={Mail}>
                      {t("bulkEmailOnlyNotice")}
                    </InlineNotice>
                  </Section>
                ) : (
                  <Section>
                    <SwitchRow
                      id="generate-qr"
                      icon={QrCode}
                      title={t("generateQrTitle")}
                      description={t("generateQrDesc")}
                      checked={generateQr}
                      onCheckedChange={setGenerateQr}
                      disabled={qrToggleDisabled}
                    >
                      {qrRemaining !== null ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {qrRemaining === 1 ? t("qrRemainingOne") : t("qrRemainingMany", { count: qrRemaining })}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">{t("qrUnlimited")}</p>
                      )}

                      {qrToggleDisabled ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          {hasStripe && canLaunch ? t("qrDisabledQuota") : t("qrDisabledReadiness")}
                        </p>
                      ) : null}
                    </SwitchRow>
                  </Section>
                )}

                <AnimatePresence initial={false}>
                  {error ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 flex items-start gap-2 border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <p>{error}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </motion.main>
        </AnimatePresence>
      </div>

      <ErrorBlock error={stepError} />

      <footer className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(buttonSecondaryClass, "cursor-pointer")}
            onClick={() => navigate(step - 1)}
            disabled={step === 1 || isPending}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            {t("back")}
          </Button>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
              {step}/{steps.length}
            </span>

            {step < steps.length ? (
              <Button
                type="button"
                className={cn(buttonPrimaryClass, "cursor-pointer")}
                onClick={handleNext}
              >
                {t("next")}
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className={cn(buttonPrimaryClass, "cursor-pointer")}
                disabled={isPending || !title.trim() || !canLaunch || (isBulkMode && !bulkCsvPreview)}
                onClick={handleSubmit}
              >
                {isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : isBulkMode ? (
                  <Mail className="mr-2 size-4" />
                ) : (
                  <LinkIcon className="mr-2 size-4" />
                )}
                {isPending ? t("creating") : isBulkMode ? t("bulkCreateTransaction") : t("createTransaction")}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
