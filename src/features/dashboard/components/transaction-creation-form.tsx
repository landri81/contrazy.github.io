"use client"

import React, { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Variants } from "framer-motion"
import type { ContractTemplate, ChecklistTemplate } from "@prisma/client"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileText,
  Info,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Wallet,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { Button } from "@/components/ui/button"
import { CharacterCount } from "@/components/ui/character-count"
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

type TransactionCreationFormProps = {
  contracts: ContractTemplate[]
  checklists: ChecklistTemplate[]
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  usage: VendorActionsUsageRecord | null
  onLinkCreated?: (record: VendorLinkRecord, usage: VendorActionsUsageRecord | null) => void
  onDirtyChange?: (dirty: boolean) => void
  onSuccessStateChange?: (success: boolean) => void
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
  return amountEur * 0.02 + 0.25
}

// ── Step config ────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    label: "Info",
    title: "Basics",
    description: "Set the internal title and context.",
    icon: FileText,
  },
  {
    id: 2,
    label: "Payment",
    title: "Amounts",
    description: "Choose the service payment, deposit, or both.",
    icon: CreditCard,
  },
  {
    id: 3,
    label: "Documents",
    title: "Requirements",
    description: "Add uploads, contract, and optional KYC.",
    icon: ShieldCheck,
  },
  {
    id: 4,
    label: "Review",
    title: "Launch",
    description: "Check the flow and decide on QR generation.",
    icon: LinkIcon,
  },
]

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

function StepProgress({ current }: { current: number }) {
  const currentStep = STEPS[current - 1]

  return (
    <div className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Step {current} of {STEPS.length}
          </div>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)] ring-1 ring-[var(--contrazy-teal)]/12">
              <currentStep.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight text-foreground">{currentStep.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{currentStep.description}</p>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex shrink-0 items-center rounded-full border border-border/70 bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {Math.round((current / STEPS.length) * 100)}% complete
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-border/80">
        <motion.div
          className="h-full rounded-full bg-[var(--contrazy-teal)]"
          animate={{ width: `${(current / STEPS.length) * 100}%` }}
          transition={{ duration: 0.28, ease: motionEase }}
        />
      </div>

      <div className="mt-4 hidden grid-cols-4 gap-2 md:grid">
        {STEPS.map((s) => {
          const Icon = s.icon
          const done = current > s.id
          const active = current === s.id

          return (
            <div
              key={s.id}
              className={cn(
                "rounded-2xl border px-3 py-2.5 transition-all",
                active
                  ? "border-[var(--contrazy-teal)]/25 bg-[var(--contrazy-teal)]/8 shadow-sm"
                  : done
                    ? "border-border/80 bg-background/80"
                    : "border-border/60 bg-muted/25"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-[11px] font-semibold",
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
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{s.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 md:hidden">
        {STEPS.map((s) => {
          const Icon = s.icon
          const done = current > s.id
          const active = current === s.id

          return (
            <div key={s.id} className="space-y-2">
              <div
                className={cn(
                  "flex h-9 items-center justify-center rounded-2xl border",
                  active
                    ? "border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]"
                    : done
                      ? "border-border/80 bg-background text-(--contrazy-navy)"
                      : "border-border/60 bg-muted/20 text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
              </div>
              <p className={cn("text-center text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </p>
            </div>
          )
        })}
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
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
        <Icon className="size-5 text-[var(--contrazy-teal)]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        <p className="mt-1 text-base font-semibold tracking-tight text-foreground">{title}</p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
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

  // UI state
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [successLink, setSuccessLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const amountNum = parseFloat(amount) || 0
  const depositNum = parseFloat(depositAmount) || 0
  const platformFee = depositNum > 0 ? depositFee(depositNum) : 0
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
  const contractLabel = contractId === "none" ? "No contract" : getTemplateLabel(selectedContract, "Selected contract")
  const checklistLabel = checklistId === "none" ? "No uploads" : getTemplateLabel(selectedChecklist, "Selected checklist")

  const txKind =
    amountNum > 0 && depositNum > 0 ? "HYBRID"
    : depositNum > 0 ? "DEPOSIT"
    : amountNum > 0 ? "PAYMENT"
    : null

  const KIND_LABELS: Record<string, string> = {
    PAYMENT: "Service Payment only",
    DEPOSIT: "Deposit Hold only",
    HYBRID: "Payment + Deposit",
  }

  const clientSteps = [
    { key: "profile", label: "Profile" },
    checklistId !== "none" && { key: "documents", label: "Documents" },
    requiresKyc && { key: "kyc", label: "ID Verification" },
    contractId !== "none" && { key: "contract", label: "Review & Sign" },
    (amountNum > 0 || depositNum > 0) && { key: "payment", label: "Payment" },
    { key: "complete", label: "Complete" },
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
    generateQr
  )

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

  function handleNext() {
    setStepError(null)

    if (step === 1) {
      if (!title.trim()) {
        setStepError("Please enter a transaction title to continue.")
        return
      }
    }

    if (step === 2) {
      if (hasStripe && canLaunch && amountNum <= 0 && depositNum <= 0) {
        setStepError("Set at least one amount — a deposit hold, a service payment, or both.")
        return
      }
      if (amount && (isNaN(parseFloat(amount)) || parseFloat(amount) < 0.5)) {
        setStepError("Minimum service payment is €0.50")
        return
      }
      if (depositAmount && (isNaN(parseFloat(depositAmount)) || parseFloat(depositAmount) < 0.5)) {
        setStepError("Minimum deposit hold is €0.50")
        return
      }
    }

    navigate(step + 1)
  }

  async function handleSubmit() {
    setError(null)

    if (!canLaunch) { setError(blockedMessage); return }
    if (!hasStripe) { setError("Connect Stripe before creating live customer transactions."); return }

    if (amountNum <= 0 && depositNum <= 0) {
      setError("Enter a service payment amount, a deposit hold amount, or both before generating a link.")
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
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.message || "Failed to create transaction"); return }

      const link = `${window.location.origin}/t/${data.link.token}`
      setSuccessLink(link)
      if (onLinkCreated && data.linkRecord) {
        onLinkCreated(data.linkRecord, data.actionUsage ?? null)
      }
    } catch {
      setError("An unexpected error occurred.")
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
              <p className="text-base font-semibold text-emerald-950">Transaction created</p>
              <p className="mt-1 text-sm text-emerald-900/75">
                {generateQr
                  ? "Share this secure link or stored QR code with your client."
                  : "Share this secure link now. You can generate a QR later from Recent links if you need one."}
              </p>
            </div>
          </div>
        </div>

        <div className="scrollbar-thin-subtle min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={successLink} className="bg-white text-xs" />
            <Button type="button" variant="outline" className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          {generateQr ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
              <QRCodeSVG value={successLink} size={140} level="M" includeMargin />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <QrCode className="size-3.5" />
                Stored QR ready to scan
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/90 p-4 text-sm text-emerald-800 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 items-center justify-center rounded-xl bg-emerald-100">
                  <LockKeyhole className="size-4 text-emerald-700" />
                </div>
                <div>
                  <p className="font-medium">QR not generated</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This transaction is live with the secure link only. Generate a QR later from the Recent links manager when quota is available.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-emerald-100/80 bg-white/90 px-4 py-4 sm:px-6">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleReset}>
            Create another transaction
          </Button>
        </div>
      </div>
    )
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0">
        <StepProgress current={step} />
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
              <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
                <StepIntro
                  icon={FileText}
                  eyebrow="Step one"
                  title="Name the transaction clearly"
                  description="Use a short operational title so you can find the workflow quickly later."
                />

                <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g. Rental #104 — BMW X5, 3 days"
                    maxLength={INPUT_LIMITS.transactionTitle}
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setStepError(null) }}
                    autoFocus
                  />
                </div>

                <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  <Label htmlFor="notes">
                    Internal notes{" "}
                    <span className="text-xs font-normal text-muted-foreground">(private, not shown to client)</span>
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Any internal reference or reminders…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={INPUT_LIMITS.transactionNotes}
                    className="min-h-[72px] resize-none text-sm"
                  />
                  <CharacterCount current={notes.length} limit={INPUT_LIMITS.transactionNotes} className="text-right" />
                </div>
              </div>
            )}

            {/* ── Step 2: Payment ──────────────────────────────────────── */}
            {step === 2 && (
              <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
                <StepIntro
                  icon={CreditCard}
                  eyebrow="Step two"
                  title="Choose the money flow"
                  description="Set a service payment, a deposit hold, or both. At least one amount is required to launch."
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
                          Payment features require a connected Stripe account.{" "}
                          <a href="/vendor/stripe" className="font-semibold underline">Connect Stripe →</a>
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
                          Security Deposit
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Primary</span>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          The card is held only. Capture or release it after the work is complete.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="depositAmount" className="text-xs">Hold amount (EUR)</Label>
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
                            <span>Hold amount</span>
                            <span className="font-medium text-foreground">€{depositNum.toFixed(2)}</span>
                          </div>
                          <div className="mt-1 flex justify-between text-muted-foreground">
                            <span>Platform fee</span>
                            <span>€{platformFee.toFixed(2)}</span>
                          </div>
                          <div className="mt-2 border-t border-amber-100 pt-2 text-muted-foreground">
                            If captured you receive <strong>€{(depositNum - platformFee).toFixed(2)}</strong>.
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
                          Service Payment
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border">Optional</span>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Charged immediately. Stripe fees are deducted from the collected amount.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount" className="text-xs">Amount (EUR)</Label>
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
                          Client pays <strong>€{amountNum.toFixed(2)}</strong>. Estimated payout after fees:{" "}
                          <strong>€{(amountNum - amountNum * 0.014 - 0.25).toFixed(2)}</strong>.
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
              </div>
            )}

            {/* ── Step 3: Documents ────────────────────────────────────── */}
            {step === 3 && (
              <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
                <StepIntro
                  icon={ShieldCheck}
                  eyebrow="Step three"
                  title="Attach the right requirements"
                  description="Choose what the client must upload, review, or verify before the workflow is complete."
                />

                <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  <Label htmlFor="checklist" className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    Required Uploads
                  </Label>
                  <Select value={checklistId} onValueChange={(value) => setChecklistId(value ?? "none")}>
                    <SelectTrigger id="checklist">
                      <span className={cn("flex-1 truncate text-sm", checklistId === "none" && "text-muted-foreground")}>{checklistLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No uploads needed</SelectItem>
                      {checklists.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="block max-w-60 truncate">{getTemplateLabel(c, "Untitled checklist")}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
                  <Label htmlFor="contract" className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    Contract Template
                  </Label>
                  <Select value={contractId} onValueChange={(value) => setContractId(value ?? "none")}>
                    <SelectTrigger id="contract">
                      <span className={cn("flex-1 truncate text-sm", contractId === "none" && "text-muted-foreground")}>{contractLabel}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No contract needed</SelectItem>
                      {contracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="block max-w-60 truncate">{getTemplateLabel(c, "Untitled contract")}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                </div>

                <div className="flex items-start justify-between gap-4 rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                      <ShieldCheck className="size-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Require ID document</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Client uploads a government-issued photo ID. You review it from the transaction detail page.
                      </p>
                      {!canUseKycInPlan ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Included from Pro plan and above.
                        </p>
                      ) : remainingKyc !== null && remainingKyc <= 0 ? (
                        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                          Your included KYC quota is fully used for this billing period.
                        </p>
                      ) : remainingKyc !== null ? (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {remainingKyc} verification{remainingKyc === 1 ? "" : "s"} remaining this period.
                        </p>
                      ) : null}
                      {requiresKyc && (
                        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                          Client can continue while their ID is under review.
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
              <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
                <StepIntro
                  icon={LinkIcon}
                  eyebrow="Final step"
                  title="Review and launch"
                  description="Confirm the client journey, decide whether this transaction needs a QR, then create the secure link."
                />

                {/* Summary */}
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                  <div className="rounded-3xl border border-border/70 bg-background shadow-sm">
                    <div className="border-b border-border/70 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">Transaction summary</p>
                    </div>
                    <div className="divide-y divide-border/50 text-sm">
                      <div className="flex items-start justify-between px-4 py-3">
                        <span className="text-muted-foreground">Title</span>
                        <span className="ml-4 max-w-[220px] truncate text-right font-medium text-foreground">{title || "—"}</span>
                      </div>

                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium text-foreground">{txKind ? KIND_LABELS[txKind] : "—"}</span>
                      </div>

                      {depositNum > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-muted-foreground">Deposit hold</span>
                          <span className="font-medium text-foreground">€{depositNum.toFixed(2)}</span>
                        </div>
                      )}

                      {amountNum > 0 && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-muted-foreground">Service payment</span>
                          <span className="font-medium text-foreground">€{amountNum.toFixed(2)}</span>
                        </div>
                      )}

                      {contractId !== "none" && (
                        <div className="flex items-start justify-between px-4 py-3">
                          <span className="text-muted-foreground">Contract</span>
                          <span className="ml-4 max-w-[180px] truncate text-right font-medium text-foreground">{contractLabel}</span>
                        </div>
                      )}

                      {checklistId !== "none" && (
                        <div className="flex items-start justify-between px-4 py-3">
                          <span className="text-muted-foreground">Uploads</span>
                          <span className="ml-4 max-w-[180px] truncate text-right font-medium text-foreground">{checklistLabel}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between px-4 py-3">
                        <span className="text-muted-foreground">ID verification</span>
                        <span className={cn("font-medium", requiresKyc ? "text-foreground" : "text-muted-foreground")}>
                          {requiresKyc ? "Required" : "Not required"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Client journey</p>
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
                    </div>

                    <div className="rounded-3xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                        <QrCode className="size-4 text-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">Generate QR now</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Optional. The secure link always works without a QR.
                        </p>
                        {qrRemaining !== null ? (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {qrRemaining} QR code{qrRemaining === 1 ? "" : "s"} remaining this billing period.
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-muted-foreground">Unlimited QR generation on your current plan.</p>
                        )}
                        {qrToggleDisabled ? (
                          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                            {hasStripe && canLaunch
                              ? "QR generation is unavailable until you have remaining quota."
                              : "Complete workspace readiness first, then generate QR when needed."}
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
      <div className="shrink-0 border-t border-border/70 bg-white/95 px-4 py-4 supports-backdrop-filter:backdrop-blur sm:px-6">
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
            Back
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
            Next
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
            {isPending ? "Creating…" : "Create Transaction"}
          </Button>
        )}
        </div>
      </div>
    </div>
  )
}
