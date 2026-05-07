"use client"

import React, { useEffect, useState } from "react"
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
  CreditCard,
  FileText,
  Info,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  Plus,
  QrCode,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
import { Link } from "@/i18n/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { INPUT_LIMITS } from "@/lib/validation/input-limits"
import type { VendorActionsUsageRecord, VendorLinkRecord } from "@/features/dashboard/server/dashboard-data"
import {
  paymentCollectionTimingOptions,
  requirementCategoryOptions,
  requirementTypeOptions,
  type PaymentCollectionTimingValue,
  type RequirementCategoryValue,
  type RequirementTypeValue,
} from "@/features/transactions/contract-flow"

type TransactionCreationFormProps = {
  contracts: ContractTemplate[]
  checklists: Array<ChecklistTemplate & { items: ChecklistItem[] }>
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  usage: VendorActionsUsageRecord | null
  onLinkCreated?: (record: VendorLinkRecord, usage: VendorActionsUsageRecord | null) => void
  onDirtyChange?: (dirty: boolean) => void
  onSuccessStateChange?: (success: boolean) => void
}

type DraftRequirement = {
  label: string
  description: string
  type: RequirementTypeValue
  category: RequirementCategoryValue
  customCategoryLabel: string
  required: boolean
}

function createDraftRequirement(item?: Partial<ChecklistItem>): DraftRequirement {
  return {
    label: item?.label ?? "",
    description: item?.description ?? "",
    type: (item?.type as RequirementTypeValue | undefined) ?? "DOCUMENT",
    category: (item?.category as RequirementCategoryValue | undefined) ?? "CUSTOM",
    customCategoryLabel: item?.customCategoryLabel ?? "",
    required: item?.required ?? true,
  }
}

function getTemplateLabel(
  item: ContractTemplate | ChecklistTemplate | undefined,
  fallback: string
) {
  if (!item) return fallback
  const t = item as ContractTemplate & ChecklistTemplate & { name?: string | null; title?: string | null; label?: string | null }
  return t.name?.trim() || t.title?.trim() || t.label?.trim() || fallback
}

function parseEur(val: string): number | null {
  const n = parseFloat(val)
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
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

// ── Step config ────────────────────────────────────────────────────────────

const STEP_ICONS = [FileText, CreditCard, ShieldCheck, LinkIcon] as const

// ── Framer-motion variants ────────────────────────────────────────────────

const motionEase = [0.25, 0.46, 0.45, 0.94] as const

const slideVariants: Variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "52%" : "-52%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: motionEase },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? "-52%" : "52%",
    opacity: 0,
    transition: { duration: 0.22, ease: motionEase },
  }),
}

// ── Progress indicator ─────────────────────────────────────────────────────

type StepDef = { id: number; label: string; title: string; description: string; icon: React.ComponentType<{ className?: string }> }

function StepProgress({ current, steps, t }: { current: number; steps: StepDef[]; t: ReturnType<typeof useTranslations<"dashboard.vendor.transactionCreation">> }) {
  const currentStep = steps[current - 1]
  const progressPercent = Math.round((current / steps.length) * 100)

  return (
    <div className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t("stepOf", { current, total: steps.length })}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--contrazy-teal)]/10 px-3 py-1 text-xs font-semibold text-[var(--contrazy-teal)] ring-1 ring-[var(--contrazy-teal)]/12">
                <currentStep.icon className="size-3.5" />
                {currentStep.title}
              </div>
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">{currentStep.description}</p>
          </div>

          <div className="hidden shrink-0 sm:flex items-center rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {t("percentComplete", { percent: progressPercent })}
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/80">
          <motion.div
            className="h-full rounded-full bg-[var(--contrazy-teal)]"
            animate={{ width: `${(current / steps.length) * 100}%` }}
            transition={{ duration: 0.28, ease: motionEase }}
          />
        </div>

        <div className="scrollbar-thin-subtle -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0">
          {steps.map((s) => {
            const Icon = s.icon
            const done = current > s.id
            const active = current === s.id

            return (
              <div
                key={s.id}
                className={cn(
                  "min-w-[152px] rounded-2xl border px-3 py-2 transition-all md:min-w-0",
                  active
                    ? "border-[var(--contrazy-teal)]/25 bg-[var(--contrazy-teal)]/8 shadow-sm"
                    : done
                      ? "border-border/80 bg-background/85"
                      : "border-border/60 bg-muted/20"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      active
                        ? "bg-[var(--contrazy-teal)] text-slate-950"
                        : done
                          ? "bg-(--contrazy-navy) text-white"
                          : "bg-background text-muted-foreground ring-1 ring-border"
                    )}
                  >
                    {done ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {active ? t("currentStep") : done ? t("completed") : t("stepN", { n: s.id })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StepIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ElementType
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.78),rgba(255,255,255,0.94))] px-3.5 py-3 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
        <Icon className="size-4.5 text-[var(--contrazy-teal)]" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          <span className="hidden size-1 rounded-full bg-border/80 sm:block" />
          <p className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</p>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function TransactionCreationForm({
  contracts,
  checklists,
  hasStripe,
  canLaunch,
  blockedMessage,
  usage,
  onLinkCreated,
  onDirtyChange,
  onSuccessStateChange,
}: TransactionCreationFormProps) {
  const t = useTranslations("dashboard.vendor.transactionCreation")

  const reqCategoryLabels: Record<string, string> = {
    ID: t("reqCategoryId"),
    PROOF_OF_ADDRESS: t("reqCategoryProofOfAddress"),
    DRIVER_LICENSE: t("reqCategoryDriverLicense"),
    COMPANY_REGISTRATION: t("reqCategoryCompanyRegistration"),
    CONTRACT_ATTACHMENT: t("reqCategoryContractAttachment"),
    CUSTOM: t("reqCategoryCustom"),
    OTHER: t("reqCategoryOther"),
  }

  function translatedCategoryLabel(category: string, customLabel?: string | null) {
    if (category === "OTHER" && customLabel?.trim()) return customLabel.trim()
    return reqCategoryLabels[category] ?? t("reqCategoryCustom")
  }

  const reqTypeLabels: Record<string, string> = {
    DOCUMENT: t("reqTypeDocument"),
    PHOTO: t("reqTypePhoto"),
    TEXT: t("reqTypeText"),
  }

  const paymentTimingLabels: Record<string, { label: string; description: string }> = {
    AFTER_SIGNING: { label: t("paymentTimingAfterSigningLabel"), description: t("paymentTimingAfterSigningDesc") },
    AFTER_SERVICE: { label: t("paymentTimingAfterServiceLabel"), description: t("paymentTimingAfterServiceDesc") },
  }

  const STEPS: StepDef[] = [
    { id: 1, label: t("steps.info.label"),      title: t("steps.info.title"),      description: t("steps.info.description"),      icon: STEP_ICONS[0] },
    { id: 2, label: t("steps.payment.label"),   title: t("steps.payment.title"),   description: t("steps.payment.description"),   icon: STEP_ICONS[1] },
    { id: 3, label: t("steps.documents.label"), title: t("steps.documents.title"), description: t("steps.documents.description"), icon: STEP_ICONS[2] },
    { id: 4, label: t("steps.review.label"),    title: t("steps.review.title"),    description: t("steps.review.description"),    icon: STEP_ICONS[3] },
  ]

  // Step navigation
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)

  // Form state
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [amount, setAmount] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [contractId, setContractId] = useState<string>("none")
  const [checklistId, setChecklistId] = useState<string>("none")
  const [requiresKyc, setRequiresKyc] = useState(false)
  const [generateQr, setGenerateQr] = useState(false)
  const [paymentCollectionTiming, setPaymentCollectionTiming] = useState<PaymentCollectionTimingValue>("AFTER_SIGNING")
  const [requireClientCompany, setRequireClientCompany] = useState(false)
  const [requirements, setRequirements] = useState<DraftRequirement[]>([])

  // UI state
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [successLink, setSuccessLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const amountNum = parseFloat(amount) || 0
  const depositNum = parseFloat(depositAmount) || 0
  const depositPricing = depositNum > 0 ? depositFee(depositNum) : null
  const financeDisabled = !hasStripe || !canLaunch
  const qrRemaining = usage?.qrCodes.remaining ?? null
  const canUseKycInPlan = usage?.kyc.allowed ?? false
  const remainingKyc = usage?.kyc.remaining ?? null
  const qrToggleDisabled = financeDisabled || (qrRemaining !== null && qrRemaining <= 0)
  const kycDisabled =
    financeDisabled ||
    !canUseKycInPlan ||
    (remainingKyc !== null && remainingKyc <= 0)

  const selectedContract = contracts.find((c) => c.id === contractId)
  const selectedChecklist = checklists.find((c) => c.id === checklistId)
  const contractLabel = contractId === "none" ? t("noContract") : getTemplateLabel(selectedContract, t("selectedContract"))
  const checklistLabel = checklistId === "none" ? t("noUploads") : getTemplateLabel(selectedChecklist, t("selectedChecklist"))

  const txKind =
    amountNum > 0 && depositNum > 0 ? "HYBRID"
    : depositNum > 0 ? "DEPOSIT"
    : amountNum > 0 ? "PAYMENT"
    : null

  const KIND_LABELS: Record<string, string> = {
    PAYMENT: t("kindPayment"),
    DEPOSIT: t("kindDeposit"),
    HYBRID: t("kindHybrid"),
  }

  const clientSteps = [
    { key: "profile", label: t("clientStepProfile") },
    requirements.length > 0 && { key: "documents", label: t("clientStepDocuments") },
    requiresKyc && { key: "kyc", label: t("clientStepKyc") },
    contractId !== "none" && { key: "contract", label: t("clientStepContract") },
    depositNum > 0 && { key: "payment", label: t("clientStepPayment") },
    amountNum > 0 && paymentCollectionTiming === "AFTER_SIGNING" && {
      key: "service-payment",
      label: depositNum > 0 ? t("clientStepServicePayment") : t("clientStepServicePaymentOnly"),
    },
    { key: "complete", label: t("clientStepComplete") },
  ].filter(Boolean) as { key: string; label: string }[]

  const isDirty = Boolean(
    successLink ||
    step > 1 ||
    title.trim() ||
    notes.trim() ||
    amount.trim() ||
    depositAmount.trim() ||
    contractId !== "none" ||
    checklistId !== "none" ||
    requiresKyc ||
    generateQr ||
    paymentCollectionTiming !== "AFTER_SIGNING" ||
    requireClientCompany ||
    requirements.length > 0
  )

  useEffect(() => {
    if (checklistId === "none") {
      const resetTimer = setTimeout(() => {
        setRequirements([])
      }, 0)
      return () => clearTimeout(resetTimer)
    }

    const syncTimer = setTimeout(() => {
      setRequirements((selectedChecklist?.items ?? []).map((item) => createDraftRequirement(item)))
    }, 0)
    return () => clearTimeout(syncTimer)
  }, [checklistId, selectedChecklist])

  useEffect(() => {
    if (amountNum <= 0 && paymentCollectionTiming === "AFTER_SERVICE") {
      const timingTimer = setTimeout(() => {
        setPaymentCollectionTiming("AFTER_SIGNING")
      }, 0)
      return () => clearTimeout(timingTimer)
    }
  }, [amountNum, paymentCollectionTiming])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    onSuccessStateChange?.(Boolean(successLink))
  }, [onSuccessStateChange, successLink])

  function navigate(next: number) {
    setStepError(null)
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  function addRequirement() {
    setRequirements((current) => [...current, createDraftRequirement()])
  }

  function updateRequirement(index: number, patch: Partial<DraftRequirement>) {
    setRequirements((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              customCategoryLabel:
                (patch.category ?? item.category) === "OTHER"
                  ? (patch.customCategoryLabel ?? item.customCategoryLabel)
                  : "",
            }
          : item
      )
    )
  }

  function removeRequirement(index: number) {
    setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function handleNext() {
    setStepError(null)

    if (step === 1) {
      if (!title.trim()) {
        setStepError(t("errorTitle"))
        return
      }
    }

    if (step === 2) {
      if (hasStripe && canLaunch && amountNum <= 0 && depositNum <= 0) {
        setStepError(t("errorAmount"))
        return
      }
      if (amount && (isNaN(parseFloat(amount)) || parseFloat(amount) < 0.5)) {
        setStepError(t("errorMinService"))
        return
      }
      if (depositAmount && (isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) < 0.5)) {
        setStepError(t("errorMinDeposit"))
        return
      }
    }

    if (step === 3) {
      const invalidRequirement = requirements.find(
        (item) => !item.label.trim() || (item.category === "OTHER" && !item.customCategoryLabel.trim())
      )

      if (invalidRequirement) {
        setStepError(t("errorRequirements"))
        return
      }
    }

    navigate(step + 1)
  }

  async function handleSubmit() {
    setError(null)

    if (!canLaunch) { setError(blockedMessage); return }
    if (!hasStripe) { setError(t("errorNoStripe")); return }

    if (amountNum <= 0 && depositNum <= 0) {
      setError(t("errorAmountRequired"))
      navigate(2)
      return
    }

    setIsPending(true)
    try {
      const res = await fetch("/api/vendor/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            customCategoryLabel: item.category === "OTHER" ? item.customCategoryLabel || null : null,
            required: item.required,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.message || t("errorCreate")); return }

      const link = `${window.location.origin}/t/${data.link.token}`
      setSuccessLink(link)
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
    navigator.clipboard.writeText(successLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleReset() {
    setSuccessLink(null)
    setCopied(false)
    setTitle("")
    setNotes("")
    setContractId("none")
    setChecklistId("none")
    setAmount("")
    setDepositAmount("")
    setRequiresKyc(false)
    setGenerateQr(false)
    setPaymentCollectionTiming("AFTER_SIGNING")
    setRequireClientCompany(false)
    setRequirements([])
    setStepError(null)
    setError(null)
    setStep(1)
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (successLink) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,1))]">
        <div className="shrink-0 border-b border-emerald-100/80 px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
              <CheckCircle2 className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-emerald-950">{t("successTitle")}</p>
              <p className="mt-1 text-sm text-emerald-900/75">
                {generateQr ? t("successDescWithQr") : t("successDescNoQr")}
              </p>
            </div>
          </div>
        </div>

        <div className="scrollbar-thin-subtle min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={successLink} className="bg-white text-xs" />
            <Button type="button" variant="outline" className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleCopy}>
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>

          {generateQr ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
              <QRCodeSVG value={successLink} size={140} level="M" includeMargin />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <QrCode className="size-3.5" />
                {t("qrReadyLabel")}
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/90 p-4 text-sm text-emerald-800 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 items-center justify-center rounded-xl bg-emerald-100">
                  <LockKeyhole className="size-4 text-emerald-700" />
                </div>
                <div>
                  <p className="font-medium">{t("qrNotGenerated")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("qrNotGeneratedDesc")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-emerald-100/80 bg-white/90 px-4 py-4 sm:px-6">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleReset}>
            {t("createAnother")}
          </Button>
        </div>
      </div>
    )
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0">
        <StepProgress current={step} steps={STEPS} t={t} />
      </div>

      <div className="scrollbar-thin-subtle min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="min-h-full"
          >
            {/* ── Step 1: Info ────────────────────────────────────────── */}
            {step === 1 && (
              <div className="mx-auto w-full  space-y-4 px-4 py-4 sm:px-6 sm:py-5">
                <StepIntro
                  icon={FileText}
                  eyebrow={t("steps.info.eyebrow")}
                  title={t("steps.info.stepTitle")}
                  description={t("steps.info.stepDescription")}
                />

                <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  <Label htmlFor="title">
                    {t("titleLabel")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder={t("titlePlaceholder")}
                    maxLength={INPUT_LIMITS.transactionTitle}
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setStepError(null) }}
                    autoFocus
                  />
                </div>

                <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  <Label htmlFor="notes">
                    {t("notesLabel")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">{t("notesPrivate")}</span>
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder={t("notesPlaceholder")}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={INPUT_LIMITS.transactionNotes}
                    className="min-h-[72px] resize-none"
                  />
                  <CharacterCount current={notes.length} limit={INPUT_LIMITS.transactionNotes} className="text-right" />
                </div>
              </div>
            )}

            {/* ── Step 2: Payment ──────────────────────────────────────── */}
            {step === 2 && (
              <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 sm:px-6 sm:py-5">
                <StepIntro
                  icon={CreditCard}
                  eyebrow={t("steps.payment.eyebrow")}
                  title={t("steps.payment.stepTitle")}
                  description={t("steps.payment.stepDescription")}
                />

                {/* Stripe / approval warnings */}
                {(!hasStripe || !canLaunch) && (
                  <div className="space-y-2">
                    {!canLaunch && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/20">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-amber-800 dark:text-amber-300">{blockedMessage}</p>
                      </div>
                    )}
                    {!hasStripe && (
                      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/20">
                        <Info className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <p className="text-blue-800 dark:text-blue-300">
                          {t("stripeRequired")}{" "}
                          <Link href="/vendor/stripe" className="font-semibold underline">{t("connectStripe")} →</Link>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,1))] p-4 shadow-sm">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
                        <Wallet className="size-4 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          {t("depositTitle")}
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{t("depositBadge")}</span>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t("depositDesc")}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="depositAmount" className="text-xs">{t("depositHoldLabel")}</Label>
                      <Input
                        id="depositAmount"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => { setDepositAmount(e.target.value); setStepError(null) }}
                        disabled={financeDisabled}
                      />
                      {depositNum > 0 ? (
                        <div className="rounded-2xl border border-amber-100 bg-white/85 p-3 text-xs">
                          <div className="flex justify-between text-muted-foreground">
                            <span>{t("holdAmount")}</span>
                            <span className="font-medium text-foreground">€{depositNum.toFixed(2)}</span>
                          </div>
                          <div className="mt-1 flex justify-between text-muted-foreground">
                            <span>{t("stripeFeeEstimate")}</span>
                            <span>€{depositPricing?.stripeFee.toFixed(2)}</span>
                          </div>
                          <div className="mt-1 flex justify-between text-muted-foreground">
                            <span>{t("platformMargin")}</span>
                            <span>€{depositPricing?.platformFee.toFixed(2)}</span>
                          </div>
                          <div className="mt-2 border-t border-amber-100 pt-2 text-muted-foreground">
                            {t("ifCaptured", { amount: `€${depositPricing?.vendorNet.toFixed(2)}` })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,1))] p-4 shadow-sm">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                        <CreditCard className="size-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          {t("servicePaymentTitle")}
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">{t("servicePaymentOptional")}</span>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t("servicePaymentDesc")}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-xs">{t("amountLabel")}</Label>
                      <Input
                        id="amount"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => { setAmount(e.target.value); setStepError(null) }}
                        disabled={financeDisabled}
                      />
                      {amountNum > 0 ? (
                        <div className="rounded-2xl border border-emerald-100 bg-white/85 p-3 text-xs text-muted-foreground">
                          {t("clientPays", { amount: `€${amountNum.toFixed(2)}`, payout: `€${(amountNum - amountNum * 0.014 - 0.25).toFixed(2)}` })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Kind badge */}
                {txKind && (
                  <div className="flex justify-start">
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm">
                      {KIND_LABELS[txKind]}
                    </span>
                  </div>
                )}

                {amountNum > 0 ? (
                  <div className="rounded-3xl border border-border/70 bg-background p-4 shadow-sm">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                        <Clock3 className="size-4 text-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("timingTitle")}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t("timingDesc")}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {paymentCollectionTimingOptions.map((option) => {
                        const active = paymentCollectionTiming === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setPaymentCollectionTiming(option.value)}
                            className={cn(
                              "rounded-2xl cursor-pointer border px-4 py-3 text-left transition-all",
                              active
                                ? "border-[var(--contrazy-teal)]/40 bg-[var(--contrazy-teal)]/8 shadow-sm"
                                : "border-border/70 bg-muted/15 hover:bg-muted/30"
                            )}
                          >
                            <p className="text-sm font-medium text-foreground">{paymentTimingLabels[option.value]?.label ?? option.label}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{paymentTimingLabels[option.value]?.description ?? option.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Step 3: Documents ────────────────────────────────────── */}
            {step === 3 && (
              <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 sm:px-6 sm:py-5">
                <StepIntro
                  icon={ShieldCheck}
                  eyebrow={t("steps.documents.eyebrow")}
                  title={t("steps.documents.stepTitle")}
                  description={t("steps.documents.stepDescription")}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  <Label htmlFor="checklist" className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    {t("requiredUploads")}
                  </Label>
                  <Select value={checklistId} onValueChange={(value) => setChecklistId(value ?? "none")}>
                    <SelectTrigger id="checklist">
                      <span className={cn("flex-1 truncate text-sm", checklistId === "none" && "text-muted-foreground")}>{checklistLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("noUploadsNeeded")}</SelectItem>
                      {checklists.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="block max-w-60 truncate">{getTemplateLabel(c, t("untitledChecklist"))}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  <Label htmlFor="contract" className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    {t("contractTemplate")}
                  </Label>
                  <Select value={contractId} onValueChange={(value) => setContractId(value ?? "none")}>
                    <SelectTrigger id="contract">
                      <span className={cn("flex-1 truncate text-sm", contractId === "none" && "text-muted-foreground")}>{contractLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("noContractNeeded")}</SelectItem>
                      {contracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="block max-w-60 truncate">{getTemplateLabel(c, t("untitledContract"))}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-border/70 bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("perTransactionTitle")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("perTransactionDesc")}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={addRequirement}>
                      <Plus className="mr-1.5 size-3.5" />
                      {t("addRequirement")}
                    </Button>
                  </div>

                  {requirements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                      {t("noRequirements")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {requirements.map((item, index) => (
                        <div key={`${item.label}-${index}`} className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs">{t("reqLabel")}</Label>
                              <Input
                                value={item.label}
                                onChange={(event) => updateRequirement(index, { label: event.target.value })}
                                placeholder={t("reqLabelPlaceholder")}
                                maxLength={INPUT_LIMITS.checklistItemLabel}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">{t("reqType")}</Label>
                              <Select
                                value={item.type}
                                onValueChange={(value) => updateRequirement(index, { type: value as RequirementTypeValue })}
                              >
                                <SelectTrigger>
                                  <span className="truncate text-sm">
                                    {reqTypeLabels[item.type] ?? t("reqTypeDocument")}
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  {requirementTypeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {reqTypeLabels[option.value] ?? option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">{t("reqCategory")}</Label>
                              <Select
                                value={item.category}
                                onValueChange={(value) => updateRequirement(index, { category: value as RequirementCategoryValue })}
                              >
                                <SelectTrigger>
                                  <span className="truncate text-sm">{translatedCategoryLabel(item.category, item.customCategoryLabel)}</span>
                                </SelectTrigger>
                                <SelectContent>
                                  {requirementCategoryOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {reqCategoryLabels[option.value] ?? option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">{t("reqOtherLabel")}</Label>
                              <Input
                                value={item.customCategoryLabel}
                                onChange={(event) => updateRequirement(index, { customCategoryLabel: event.target.value })}
                                placeholder={t("reqCustomPlaceholder")}
                                maxLength={INPUT_LIMITS.checklistItemLabel}
                                disabled={item.category !== "OTHER"}
                              />
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                            <div className="space-y-2">
                              <Label className="text-xs">{t("reqInstructions")}</Label>
                              <div>
                                <Textarea
                                  value={item.description}
                                  onChange={(event) => updateRequirement(index, { description: event.target.value })}
                                  placeholder={item.type === "TEXT" ? t("reqTextPlaceholder") : t("reqUploadPlaceholder")}
                                  maxLength={INPUT_LIMITS.checklistItemInstructions}
                                  className="min-h-[72px] resize-none"
                                />
                                <CharacterCount
                                  current={item.description.length}
                                  limit={INPUT_LIMITS.checklistItemInstructions}
                                  className="mt-1 text-right"
                                />
                              </div>
                            </div>
                            <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground">
                              <Switch
                                checked={item.required}
                                onCheckedChange={(checked) => updateRequirement(index, { required: Boolean(checked) })}
                              />
                              {t("reqRequired")}
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => removeRequirement(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between gap-4 rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                      <Building2 className="size-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("requireCompanyTitle")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("requireCompanyDesc")}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={requireClientCompany}
                    onCheckedChange={setRequireClientCompany}
                    className="mt-0.5 shrink-0"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                      <ShieldCheck className="size-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{t("requireIdTitle")}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("requireIdDesc")}
                      </p>
                      {!canUseKycInPlan ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t("kycPlanRequired")}
                        </p>
                      ) : remainingKyc !== null && remainingKyc <= 0 ? (
                        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                          {t("kycQuotaUsed")}
                        </p>
                      ) : remainingKyc !== null ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {remainingKyc === 1 ? t("kycRemainingOne") : t("kycRemainingMany", { count: remainingKyc })}
                        </p>
                      ) : null}
                      {requiresKyc && (
                        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                          {t("kycNote")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={requiresKyc}
                    onCheckedChange={setRequiresKyc}
                    disabled={kycDisabled}
                    className="mt-0.5 shrink-0"
                  />
                </div>
              </div>
            )}

            {/* ── Step 4: Review ────────────────────────────────────────── */}
            {step === 4 && (
              <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 sm:px-6 sm:py-5">
                <StepIntro
                  icon={LinkIcon}
                  eyebrow={t("steps.review.eyebrow")}
                  title={t("steps.review.stepTitle")}
                  description={t("steps.review.stepDescription")}
                />

                {/* Summary */}
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                  <div className="rounded-3xl border border-border/70 bg-background shadow-sm">
                    <div className="border-b border-border/70 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{t("summaryTitle")}</p>
                    </div>
                    <div className="divide-y divide-border/50 text-sm">
                      <div className="flex items-start justify-between px-4 py-3">
                        <span className="text-muted-foreground">{t("summaryTitleRow")}</span>
                        <span className="ml-4 max-w-[220px] truncate text-right font-medium text-foreground">{title || "—"}</span>
                      </div>

                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-muted-foreground">{t("summaryType")}</span>
                        <span className="font-medium text-foreground">{txKind ? KIND_LABELS[txKind] : "—"}</span>
                      </div>

                      {depositNum > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-muted-foreground">{t("summaryDeposit")}</span>
                          <span className="font-medium text-foreground">€{depositNum.toFixed(2)}</span>
                        </div>
                      )}

                      {amountNum > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-muted-foreground">{t("summaryService")}</span>
                          <span className="font-medium text-foreground">€{amountNum.toFixed(2)}</span>
                        </div>
                      )}

                      {amountNum > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-muted-foreground">{t("summaryTiming")}</span>
                          <span className="font-medium text-foreground">{paymentTimingLabels[paymentCollectionTiming]?.label ?? t("paymentTimingAfterSigningLabel")}</span>
                        </div>
                      )}

                      {contractId !== "none" && (
                        <div className="flex items-start justify-between px-4 py-3">
                          <span className="text-muted-foreground">{t("summaryContract")}</span>
                          <span className="ml-4 max-w-[180px] truncate text-right font-medium text-foreground">{contractLabel}</span>
                        </div>
                      )}

                      {requirements.length > 0 && (
                        <div className="flex items-start justify-between px-4 py-3">
                          <span className="text-muted-foreground">{t("summaryRequirements")}</span>
                          <span className="ml-4 max-w-[180px] truncate text-right font-medium text-foreground">
                            {requirements.length === 1 ? t("summaryRequirementsOne") : t("summaryRequirementsMany", { count: requirements.length })}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-muted-foreground">{t("summaryIdVerification")}</span>
                        <span className={cn("font-medium", requiresKyc ? "text-foreground" : "text-muted-foreground")}>
                          {requiresKyc ? t("required") : t("notRequired")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-muted-foreground">{t("summaryCompanyName")}</span>
                        <span className={cn("font-medium", requireClientCompany ? "text-foreground" : "text-muted-foreground")}>
                          {requireClientCompany ? t("required") : t("optional")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("clientJourney")}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {clientSteps.map((s, i) => (
                          <div key={s.key} className="flex items-center gap-1.5">
                            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
                              {s.label}
                            </span>
                            {i < clientSteps.length - 1 && (
                              <ArrowRight className="size-3 shrink-0 text-muted-foreground/50" />
                            )}
                          </div>
                        ))}
                      </div>
                      {amountNum > 0 && paymentCollectionTiming === "AFTER_SERVICE" ? (
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          {t("deferredPaymentNote")}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                        <QrCode className="size-4 text-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("generateQrTitle")}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t("generateQrDesc")}
                        </p>
                        {qrRemaining !== null ? (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {qrRemaining === 1 ? t("qrRemainingOne") : t("qrRemainingMany", { count: qrRemaining })}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-muted-foreground">{t("qrUnlimited")}</p>
                        )}
                        {qrToggleDisabled ? (
                          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                            {hasStripe && canLaunch
                              ? t("qrDisabledQuota")
                              : t("qrDisabledReadiness")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Switch
                      checked={generateQr}
                      onCheckedChange={setGenerateQr}
                      disabled={qrToggleDisabled}
                      className="mt-0.5 shrink-0"
                    />
                  </div>
                </div>
                  </div>
                </div>

                {/* Submit error */}
                <AnimatePresence initial={false}>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Step error ──────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {stepError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2 border-t border-destructive/10 bg-destructive/5 px-5 py-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <p>{stepError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border/70 bg-white/95 px-4 py-3 supports-backdrop-filter:backdrop-blur sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1"
            onClick={() => navigate(step - 1)}
            disabled={isPending}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            {t("back")}
          </Button>
        ) : (
          <div className="flex-1" />
        )}

        {step < 4 ? (
          <Button
            type="button"
            className="w-full bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft) sm:flex-1"
            onClick={handleNext}
          >
            {t("next")}
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft) sm:flex-1"
            disabled={isPending || !title.trim() || !canLaunch}
            onClick={handleSubmit}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <LinkIcon className="mr-2 size-4" />
            )}
            {isPending ? t("creating") : t("createTransaction")}
          </Button>
        )}
        </div>
      </div>
    </div>
  )
}
