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
  Wallet,
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
  TransactionCreationInitialRequirement,
  TransactionCreationInitialValues,
} from "@/features/dashboard/transaction-creation"
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import type {
  VendorActionsUsageRecord,
  VendorLinkRecord,
} from "@/features/dashboard/server/dashboard-data"
import {
  paymentCollectionTimingOptions,
  requirementCategoryOptions,
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
  mode?: "new" | "recreate"
  initialValues?: TransactionCreationInitialValues | null
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  usage: VendorActionsUsageRecord | null
  onLinkCreated?: (record: VendorLinkRecord, usage: VendorActionsUsageRecord | null) => void
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
  exampleImage: RequirementExampleDraft | null
}

type DraftCustomField = {
  id: string
  label: string
  instructions: string
  type: TransactionCustomFieldTypeValue
  selectOptions: string[]
}

type StepDef = {
  id: number
  label: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
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

function createCustomFieldId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `custom-field-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function createDraftRequirement(item?: Partial<ChecklistItem>): DraftRequirement {
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
    label: item?.label ?? "",
    description: item?.description ?? "",
    type: (item?.type as RequirementTypeValue | undefined) ?? "DOCUMENT",
    category: (item?.category as RequirementCategoryValue | undefined) ?? "CUSTOM",
    customCategoryLabel: item?.customCategoryLabel ?? "",
    required: item?.required ?? true,
    exampleImage,
  }
}

function createDraftRequirementFromInitialValue(
  item: TransactionCreationInitialRequirement
): DraftRequirement {
  return {
    id: createRequirementId(),
    label: item.label,
    description: item.description,
    type: item.type,
    category: item.category,
    customCategoryLabel: item.customCategoryLabel,
    required: item.required,
    exampleImage: item.exampleImage ? { ...item.exampleImage } : null,
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

type TransactionCreationFormState = {
  title: string
  notes: string
  amount: string
  depositAmount: string
  contractId: string
  checklistId: string
  requiresKyc: boolean
  generateQr: boolean
  paymentCollectionTiming: PaymentCollectionTimingValue
  requireClientCompany: boolean
  requirements: DraftRequirement[]
  customFields: DraftCustomField[]
}

type TransactionCreationFormSnapshot = Omit<
  TransactionCreationFormState,
  "requirements" | "customFields"
> & {
  requirements: Array<{
    label: string
    description: string
    type: RequirementTypeValue
    category: RequirementCategoryValue
    customCategoryLabel: string
    required: boolean
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
}

function createInitialFormState(
  initialValues?: TransactionCreationInitialValues | null
): TransactionCreationFormState {
  return {
    title: initialValues?.title ?? "",
    notes: initialValues?.notes ?? "",
    amount: initialValues?.amount ?? "",
    depositAmount: initialValues?.depositAmount ?? "",
    contractId: initialValues?.contractTemplateId ?? "none",
    checklistId: initialValues?.checklistTemplateId ?? "none",
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
  }
}

function buildFormSnapshot(state: TransactionCreationFormState): TransactionCreationFormSnapshot {
  return {
    title: state.title,
    notes: state.notes,
    amount: state.amount,
    depositAmount: state.depositAmount,
    contractId: state.contractId,
    checklistId: state.checklistId,
    requiresKyc: state.requiresKyc,
    generateQr: state.generateQr,
    paymentCollectionTiming: state.paymentCollectionTiming,
    requireClientCompany: state.requireClientCompany,
    requirements: state.requirements.map((item) => ({
      label: item.label,
      description: item.description,
      type: item.type,
      category: item.category,
      customCategoryLabel: item.customCategoryLabel,
      required: item.required,
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
  const initialFormState = useMemo(() => createInitialFormState(initialValues), [initialValues])
  const initialSnapshot = useMemo(
    () => JSON.stringify(buildFormSnapshot(initialFormState)),
    [initialFormState]
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

  const steps = useMemo<StepDef[]>(
    () => [
      {
        id: 1,
        label: t("steps.info.label"),
        title: t("steps.info.title"),
        description: t("steps.info.description"),
        icon: FileText,
      },
      {
        id: 2,
        label: t("steps.payment.label"),
        title: t("steps.payment.title"),
        description: t("steps.payment.description"),
        icon: CreditCard,
      },
      {
        id: 3,
        label: t("summaryTiming"),
        title: t("timingTitle"),
        description: t("timingDesc"),
        icon: Clock3,
      },
      {
        id: 4,
        label: t("steps.documents.label"),
        title: t("steps.documents.title"),
        description: t("steps.documents.description"),
        icon: ShieldCheck,
      },
      {
        id: 5,
        label: t("steps.review.label"),
        title: t("steps.review.title"),
        description: t("steps.review.description"),
        icon: LinkIcon,
      },
    ],
    [t]
  )

  const [step, setStep] = useState(1)
  const [title, setTitle] = useState(initialFormState.title)
  const [notes, setNotes] = useState(initialFormState.notes)
  const [amount, setAmount] = useState(initialFormState.amount)
  const [depositAmount, setDepositAmount] = useState(initialFormState.depositAmount)
  const [contractId, setContractId] = useState<string>(initialFormState.contractId)
  const [checklistId, setChecklistId] = useState<string>(initialFormState.checklistId)
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

  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [successLink, setSuccessLink] = useState<string | null>(null)
  const [successRecord, setSuccessRecord] = useState<VendorLinkRecord | null>(null)
  const [successError, setSuccessError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isDownloadingQrImage, setIsDownloadingQrImage] = useState(false)
  const [isSharingQrImage, setIsSharingQrImage] = useState(false)
  const [uploadingRequirementIds, setUploadingRequirementIds] = useState<string[]>([])
  const qrCanvasContainerRef = useRef<HTMLDivElement | null>(null)
  const pendingLocalAssetsRef = useRef<RequirementExampleCleanupAsset[]>([])
  const skipPendingCleanupRef = useRef(false)

  const amountNum = Number.parseFloat(amount) || 0
  const depositNum = Number.parseFloat(depositAmount) || 0
  const depositPricing = depositNum > 0 ? depositFee(depositNum) : null
  const financeDisabled = !hasStripe || !canLaunch
  const qrRemaining = usage?.qrCodes.remaining ?? null
  const canUseKycInPlan = usage?.kyc.allowed ?? false
  const remainingKyc = usage?.kyc.remaining ?? null
  const qrToggleDisabled = financeDisabled || (qrRemaining !== null && qrRemaining <= 0)
  const kycDisabled =
    financeDisabled || !canUseKycInPlan || (remainingKyc !== null && remainingKyc <= 0)

  const selectedContract = contracts.find((contract) => contract.id === contractId)
  const selectedChecklist = checklists.find((checklist) => checklist.id === checklistId)
  const contractLabel =
    contractId === "none" ? t("noContract") : getTemplateLabel(selectedContract, t("selectedContract"))
  const checklistLabel =
    checklistId === "none" ? t("noUploads") : getTemplateLabel(selectedChecklist, t("selectedChecklist"))

  const txKind =
    amountNum > 0 && depositNum > 0
      ? "HYBRID"
      : depositNum > 0
        ? "DEPOSIT"
        : amountNum > 0
          ? "PAYMENT"
          : null

  const kindLabels: Record<string, string> = {
    PAYMENT: t("kindPayment"),
    DEPOSIT: t("kindDeposit"),
    HYBRID: t("kindHybrid"),
  }

  const activeStep = steps[step - 1]

  const clientSteps = [
    { key: "profile", label: t("clientStepProfile") },
    requirements.length > 0 && { key: "documents", label: t("clientStepDocuments") },
    requiresKyc && { key: "kyc", label: t("clientStepKyc") },
    customFields.length > 0 && contractId !== "none" && { key: "details", label: t("clientStepDetails") },
    contractId !== "none" && { key: "contract", label: t("clientStepContract") },
    depositNum > 0 && { key: "deposit", label: t("clientStepPayment") },
    amountNum > 0 && {
      key: "service-payment",
      label:
        depositNum > 0
          ? t("clientStepServicePayment")
          : t("clientStepServicePaymentOnly"),
    },
    { key: "complete", label: t("clientStepComplete") },
  ].filter(Boolean) as { key: string; label: string }[]

  const currentSnapshot = useMemo(
    () =>
      JSON.stringify(
        buildFormSnapshot({
          title,
          notes,
          amount,
          depositAmount,
          contractId,
          checklistId,
          requiresKyc,
          generateQr,
          paymentCollectionTiming,
          requireClientCompany,
          requirements,
          customFields,
        })
      ),
    [
      amount,
      checklistId,
      contractId,
      depositAmount,
      generateQr,
      notes,
      paymentCollectionTiming,
      requireClientCompany,
      requirements,
      customFields,
      requiresKyc,
      title,
    ]
  )
  const isDirty = Boolean(successLink || step > 1 || currentSnapshot !== initialSnapshot)

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

  function handleChecklistChange(nextChecklistId: string) {
    const currentLocalAssets = getLocalRequirementExampleAssets(requirements)

    setChecklistId(nextChecklistId)

    if (nextChecklistId === "none") {
      setRequirements([])
    } else {
      const nextChecklist = checklists.find((checklist) => checklist.id === nextChecklistId)
      setRequirements((nextChecklist?.items ?? []).map((item) => createDraftRequirement(item)))
    }

    if (currentLocalAssets.length > 0) {
      void cleanupRequirementExampleAssets(currentLocalAssets)
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
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    onSuccessStateChange?.(Boolean(successLink))
  }, [onSuccessStateChange, successLink])

  function navigate(nextStep: number) {
    setStepError(null)
    setError(null)
    setStep(Math.min(Math.max(nextStep, 1), steps.length))
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

        const nextCategory = patch.category ?? item.category
        const nextType = patch.type ?? item.type
        return {
          ...item,
          ...patch,
          exampleImage: nextType === "TEXT" ? null : (patch.exampleImage ?? item.exampleImage),
          customCategoryLabel:
            nextCategory === "OTHER"
              ? (patch.customCategoryLabel ?? item.customCategoryLabel)
              : "",
        }
      })
    )
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

    if (step === 1 && !title.trim()) {
      setStepError(t("errorTitle"))
      return false
    }

    if (step === 2) {
      if (hasStripe && canLaunch && amountNum <= 0 && depositNum <= 0) {
        setStepError(t("errorAmount"))
        return false
      }

      if (amount && (Number.isNaN(Number.parseFloat(amount)) || Number.parseFloat(amount) < 0.5)) {
        setStepError(t("errorMinService"))
        return false
      }

      if (
        depositAmount &&
        (Number.isNaN(Number.parseFloat(depositAmount)) || Number.parseFloat(depositAmount) < 0.5)
      ) {
        setStepError(t("errorMinDeposit"))
        return false
      }
    }

    if (step === 4) {
      const invalidRequirement = requirements.find(
        (item) => !item.label.trim() || (item.category === "OTHER" && !item.customCategoryLabel.trim())
      )

      if (invalidRequirement) {
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

    if (!hasStripe) {
      setError(t("errorNoStripe"))
      return
    }

    if (amountNum <= 0 && depositNum <= 0) {
      setError(t("errorAmountRequired"))
      navigate(2)
      return
    }

    if (customFields.length > 0 && contractId === "none") {
      setError(t("errorCustomFieldsContract"))
      navigate(4)
      return
    }

    setIsPending(true)

    try {
      const response = await fetch("/api/vendor/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recreateFromTransactionId,
          title,
          notes,
          contractTemplateId: contractId === "none" ? null : contractId,
          checklistTemplateId: checklistId === "none" ? null : checklistId,
          amount: amount ? parseEur(amount) : null,
          depositAmount: depositAmount ? parseEur(depositAmount) : null,
          requiresKyc,
          generateQr,
          paymentCollectionTiming,
          requireClientCompany,
          requirements: requirements.map((item) => ({
            label: item.label,
            description: item.description || null,
            type: item.type,
            category: item.category,
            customCategoryLabel:
              item.category === "OTHER" ? item.customCategoryLabel || null : null,
            required: item.required,
            exampleImageUrl: item.type === "TEXT" ? null : item.exampleImage?.assetUrl ?? null,
            exampleImagePublicId:
              item.type === "TEXT" ? null : item.exampleImage?.publicId ?? null,
            exampleImageFileName:
              item.type === "TEXT" ? null : item.exampleImage?.fileName ?? null,
          })),
          customFields: customFields.map((item) => ({
            label: item.label,
            instructions: item.instructions || null,
            type: item.type,
            selectOptions:
              item.type === "SELECT"
                ? item.selectOptions.map((option) => option.trim()).filter(Boolean)
                : [],
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || t("errorCreate"))
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
    setSuccessError(null)
    setCopied(false)
    setTitle(nextInitialState.title)
    setNotes(nextInitialState.notes)
    setContractId(nextInitialState.contractId)
    setChecklistId(nextInitialState.checklistId)
    setAmount(nextInitialState.amount)
    setDepositAmount(nextInitialState.depositAmount)
    setRequiresKyc(nextInitialState.requiresKyc)
    setGenerateQr(nextInitialState.generateQr)
    setPaymentCollectionTiming(nextInitialState.paymentCollectionTiming)
    setRequireClientCompany(nextInitialState.requireClientCompany)
    setRequirements(nextInitialState.requirements)
    setCustomFields(nextInitialState.customFields)
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

            {step === 1 ? (
              <div>
                {recreateSourceReference ? (
                  <Section>
                    <InlineNotice>
                      {t("recreateNotice", { reference: recreateSourceReference })}
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
                        <CharacterCount
                          current={notes.length}
                          limit={INPUT_LIMITS.transactionNotes}
                        />
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
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                {(!hasStripe || !canLaunch) ? (
                  <Section className="space-y-2">
                    {!canLaunch ? (
                      <InlineNotice tone="warning" icon={AlertCircle}>
                        {blockedMessage}
                      </InlineNotice>
                    ) : null}

                    {!hasStripe ? (
                      <InlineNotice>
                        {t("stripeRequired")} {" "}
                        <Link href="/vendor/stripe" className="font-semibold underline underline-offset-2">
                          {t("connectStripe")} →
                        </Link>
                      </InlineNotice>
                    ) : null}
                  </Section>
                ) : null}

                <Section>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{t("depositTitle")}</p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t("depositDesc")}</p>
                        </div>
                      </div>

                      <Field id="depositAmount" label={t("depositHoldLabel")}>
                        <Input
                          id="depositAmount"
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          value={depositAmount}
                          onChange={(event) => {
                            setDepositAmount(event.target.value)
                            setStepError(null)
                          }}
                          disabled={financeDisabled}
                          className={controlClass}
                        />
                      </Field>

                      {depositNum > 0 ? (
                        <dl className="space-y-1 border-t border-border pt-2 text-xs">
                          <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">{t("holdAmount")}</dt>
                            <dd className="font-medium text-foreground">€{depositNum.toFixed(2)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">{t("stripeFeeEstimate")}</dt>
                            <dd>€{depositPricing?.stripeFee.toFixed(2)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">{t("platformMargin")}</dt>
                            <dd>€{depositPricing?.platformFee.toFixed(2)}</dd>
                          </div>
                          <div className="border-t border-border pt-1.5 text-muted-foreground">
                            {t("ifCaptured", { amount: `€${depositPricing?.vendorNet.toFixed(2)}` })}
                          </div>
                        </dl>
                      ) : null}
                    </div>

                    <div className="space-y-3 border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                      <div className="flex items-start gap-2">
                        <CreditCard className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{t("servicePaymentTitle")}</p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t("servicePaymentDesc")}</p>
                        </div>
                      </div>

                      <Field id="amount" label={t("amountLabel")}>
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
                        <p className="border-t border-border pt-2 text-xs leading-5 text-muted-foreground">
                          {t("clientPays", {
                            amount: `€${amountNum.toFixed(2)}`,
                            payout: `€${(amountNum - amountNum * 0.014 - 0.25).toFixed(2)}`,
                          })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Section>

                {txKind ? (
                  <Section>
                    <div className="flex items-center justify-between gap-3">
                      <span className={fieldLabelClass}>{t("summaryType")}</span>
                      <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                        {kindLabels[txKind]}
                      </span>
                    </div>
                  </Section>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <Section>
                  {amountNum > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
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
                  ) : (
                    <InlineNotice>
                      {t("servicePaymentTitle")} — {t("servicePaymentOptional")}
                    </InlineNotice>
                  )}
                </Section>

                {amountNum > 0 && paymentCollectionTiming === "AFTER_SERVICE" ? (
                  <Section>
                    <InlineNotice>
                      {t("deferredPaymentNote")}
                    </InlineNotice>
                  </Section>
                ) : null}
              </div>
            ) : null}

            {step === 4 ? (
              <div>
                {missingSourceContractTemplateName && contractId === "none" ? (
                  <Section>
                    <InlineNotice tone="warning" icon={AlertCircle}>
                      {t("recreateMissingContractWarning", {
                        template: missingSourceContractTemplateName,
                      })}
                    </InlineNotice>
                  </Section>
                ) : null}

                <Section>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="checklist" label={t("requiredUploads")}>
                      <Select value={checklistId} onValueChange={(value) => void handleChecklistChange(value ?? "none")}>
                        <SelectTrigger id="checklist" className={cn(controlClass, "cursor-pointer")}>
                          <span className={cn("truncate text-sm", checklistId === "none" && "text-muted-foreground")}>{checklistLabel}</span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="cursor-pointer">
                            {t("noUploadsNeeded")}
                          </SelectItem>
                          {checklists.map((checklist) => (
                            <SelectItem key={checklist.id} value={checklist.id} className="cursor-pointer">
                              <span className="block max-w-60 truncate">
                                {getTemplateLabel(checklist, t("untitledChecklist"))}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field id="contract" label={t("contractTemplate")}>
                      <Select value={contractId} onValueChange={(value) => setContractId(value ?? "none")}>
                        <SelectTrigger id="contract" className={cn(controlClass, "cursor-pointer")}>
                          <span className={cn("truncate text-sm", contractId === "none" && "text-muted-foreground")}>{contractLabel}</span>
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
                  </div>
                </Section>

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
                    id="requires-kyc"
                    icon={ShieldCheck}
                    title={t("requireIdTitle")}
                    description={t("requireIdDesc")}
                    checked={requiresKyc}
                    onCheckedChange={setRequiresKyc}
                    disabled={kycDisabled}
                  >
                    {!canUseKycInPlan ? (
                      <p className="mt-1 text-xs text-muted-foreground">{t("kycPlanRequired")}</p>
                    ) : remainingKyc !== null && remainingKyc <= 0 ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("kycQuotaUsed")}</p>
                    ) : remainingKyc !== null ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {remainingKyc === 1 ? t("kycRemainingOne") : t("kycRemainingMany", { count: remainingKyc })}
                      </p>
                    ) : null}

                    {requiresKyc ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("kycNote")}</p>
                    ) : null}
                  </SwitchRow>
                </Section>
              </div>
            ) : null}

            {step === 5 ? (
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

                        <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                          <dt className="text-muted-foreground">{t("summaryType")}</dt>
                          <dd className="font-medium text-foreground">{txKind ? kindLabels[txKind] : "—"}</dd>
                        </div>

                        {depositNum > 0 ? (
                          <div className="flex items-center justify-between gap-4 border-b border-dotted border-border py-2">
                            <dt className="text-muted-foreground">{t("summaryDeposit")}</dt>
                            <dd className="font-medium text-foreground">€{depositNum.toFixed(2)}</dd>
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
                disabled={isPending || !title.trim() || !canLaunch}
                onClick={handleSubmit}
              >
                {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LinkIcon className="mr-2 size-4" />}
                {isPending ? t("creating") : t("createTransaction")}
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
