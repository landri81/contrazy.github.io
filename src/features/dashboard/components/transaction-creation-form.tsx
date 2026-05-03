"use client"

import React, { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useRouter } from "next/navigation"
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
  QrCode,
  ShieldCheck,
  Wallet,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
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
import type { VendorLinkRecord } from "@/features/dashboard/server/dashboard-data"

type TransactionCreationFormProps = {
  contracts: ContractTemplate[]
  checklists: ChecklistTemplate[]
  hasStripe: boolean
  canLaunch: boolean
  blockedMessage: string
  onLinkCreated?: (record: VendorLinkRecord) => void
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
  { id: 1, label: "Info" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Documents" },
  { id: 4, label: "Review" },
]

// ── Framer-motion variants ────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "52%" : "-52%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? "-52%" : "52%",
    opacity: 0,
    transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

// ── SVG Illustrations ──────────────────────────────────────────────────────

function IllustrationInfo() {
  return (
    <svg viewBox="0 0 110 88" className="h-[72px] w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <ellipse cx="54" cy="84" rx="30" ry="4" fill="#e2e8f0" />
      {/* Document */}
      <rect x="22" y="6" width="54" height="68" rx="6" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
      {/* Folded corner */}
      <path d="M58 6 L76 6 L76 24 L58 24 Z" fill="#e2e8f0" />
      <path d="M58 6 L58 24 L76 24" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
      {/* Text lines */}
      <rect x="30" y="32" width="34" height="3.5" rx="1.75" fill="#cbd5e1" />
      <rect x="30" y="42" width="28" height="3" rx="1.5" fill="#e2e8f0" />
      <rect x="30" y="51" width="32" height="3" rx="1.5" fill="#e2e8f0" />
      <rect x="30" y="60" width="22" height="3" rx="1.5" fill="#e2e8f0" />
      {/* Pen */}
      <g transform="translate(72 62) rotate(-38)">
        <rect x="-4" y="-18" width="8" height="24" rx="2.5" fill="var(--contrazy-navy, #2d3a4a)" />
        <polygon points="-4,6 0,14 4,6" fill="var(--contrazy-navy, #2d3a4a)" />
        <rect x="-4" y="-22" width="8" height="6" rx="1.5" fill="#94a3b8" />
        <rect x="-1.5" y="-14" width="3" height="16" rx="1" fill="white" opacity="0.25" />
      </g>
    </svg>
  )
}

function IllustrationPayment() {
  return (
    <svg viewBox="0 0 120 88" className="h-[72px] w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <ellipse cx="60" cy="84" rx="36" ry="4" fill="#e2e8f0" />
      {/* Back card (deposit) — amber-tinted */}
      <rect x="18" y="24" width="72" height="46" rx="8" fill="#fef3c7" stroke="#fde68a" strokeWidth="1.5" />
      <rect x="18" y="32" width="72" height="10" fill="#fde68a" />
      <rect x="26" y="52" width="20" height="8" rx="2" fill="#fbbf24" opacity="0.6" />
      {/* Lock icon on back card */}
      <g transform="translate(78, 56)">
        <rect x="-6" y="-2" width="12" height="9" rx="2" fill="#f59e0b" />
        <path d="M-3 -2 A3 3 0 0 1 3 -2" stroke="#f59e0b" strokeWidth="2.5" fill="none" />
        <circle cx="0" cy="3" r="1.5" fill="white" opacity="0.7" />
      </g>
      {/* Front card (service payment) — emerald */}
      <rect x="30" y="14" width="72" height="46" rx="8" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
      <rect x="30" y="22" width="72" height="10" fill="var(--contrazy-navy, #2d3a4a)" />
      <rect x="38" y="42" width="22" height="8" rx="2" fill="#a7f3d0" opacity="0.8" />
      <rect x="38" y="52" width="14" height="4" rx="1" fill="#d1fae5" />
      <rect x="56" y="52" width="10" height="4" rx="1" fill="#d1fae5" />
      {/* Chip */}
      <rect x="38" y="25" width="10" height="7" rx="1.5" fill="#6ee7b7" opacity="0.8" />
    </svg>
  )
}

function IllustrationDocuments() {
  return (
    <svg viewBox="0 0 110 88" className="h-[72px] w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <ellipse cx="54" cy="84" rx="32" ry="4" fill="#e2e8f0" />
      {/* Folder back */}
      <path d="M14 36 L14 74 Q14 78 18 78 L90 78 Q94 78 94 74 L94 40 Q94 36 90 36 Z" fill="#e0e7ff" stroke="#c7d2fe" strokeWidth="1.5" />
      {/* Folder tab */}
      <path d="M14 36 L14 30 Q14 26 18 26 L44 26 Q48 26 50 30 L54 36 Z" fill="#c7d2fe" stroke="#a5b4fc" strokeWidth="1.5" />
      {/* Doc 1 (back) */}
      <rect x="28" y="22" width="40" height="52" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" transform="rotate(-8 48 48)" />
      {/* Doc 2 (middle) */}
      <rect x="30" y="20" width="40" height="52" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" transform="rotate(4 50 46)" />
      {/* Doc 3 (front) */}
      <rect x="30" y="24" width="40" height="50" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* Lines on front doc */}
      <rect x="37" y="35" width="26" height="3" rx="1.5" fill="#cbd5e1" />
      <rect x="37" y="43" width="20" height="2.5" rx="1.25" fill="#e2e8f0" />
      <rect x="37" y="51" width="24" height="2.5" rx="1.25" fill="#e2e8f0" />
      {/* Checkmark circle */}
      <circle cx="80" cy="32" r="11" fill="#10b981" />
      <path d="M74 32 L78 36 L86 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IllustrationReview() {
  return (
    <svg viewBox="0 0 110 88" className="h-[72px] w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shadow */}
      <ellipse cx="55" cy="84" rx="30" ry="4" fill="#e2e8f0" />
      {/* Shield body */}
      <path d="M55 8 L86 20 L86 46 Q86 66 55 78 Q24 66 24 46 L24 20 Z" fill="var(--contrazy-navy, #2d3a4a)" />
      {/* Shield shine */}
      <path d="M55 8 L86 20 L86 46 Q86 66 55 78 Q24 66 24 46 L24 20 Z" fill="white" opacity="0.07" />
      {/* Inner shield */}
      <path d="M55 16 L80 26 L80 46 Q80 62 55 72 Q30 62 30 46 L30 26 Z" fill="white" opacity="0.06" />
      {/* Big checkmark */}
      <path d="M40 44 L50 54 L70 34" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Sparkles */}
      <circle cx="90" cy="14" r="3" fill="#fbbf24" />
      <circle cx="96" cy="28" r="2" fill="#fbbf24" opacity="0.6" />
      <circle cx="16" cy="22" r="2.5" fill="#a78bfa" opacity="0.7" />
      <circle cx="20" cy="10" r="1.5" fill="#a78bfa" opacity="0.5" />
    </svg>
  )
}

// ── Progress indicator ─────────────────────────────────────────────────────

function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex w-full items-start px-5 pb-4 pt-5">
      {STEPS.map((s, i) => {
        const done = current > s.id
        const active = current === s.id
        return (
          <React.Fragment key={s.id}>
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                  done
                    ? "bg-(--contrazy-navy) text-white"
                    : active
                    ? "bg-(--contrazy-navy) text-white ring-4 ring-(--contrazy-navy)/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="size-3.5" /> : s.id}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1.5 mt-3.5 h-0.5 flex-1 rounded-full transition-all duration-500",
                  done ? "bg-(--contrazy-navy)" : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        )
      })}
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
  onLinkCreated,
}: TransactionCreationFormProps) {
  const router = useRouter()

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
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.message || "Failed to create transaction"); return }

      const link = `${window.location.origin}/t/${data.link.token}`
      setSuccessLink(link)
      if (onLinkCreated && data.linkRecord) {
        onLinkCreated(data.linkRecord)
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
    setStepError(null)
    setError(null)
    setStep(1)
    router.refresh()
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (successLink) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/10">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Transaction created</p>
              <p className="text-sm text-emerald-700/80 dark:text-emerald-400">Share this link or QR code with your client.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 pb-5">
          <div className="flex gap-2">
            <Input readOnly value={successLink} className="bg-white text-xs dark:bg-background" />
            <Button type="button" variant="outline" className="shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-100" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-white p-5 dark:border-emerald-900 dark:bg-background">
            <QRCodeSVG value={successLink} size={140} level="M" includeMargin />
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <QrCode className="size-3.5" />
              Scan with mobile device
            </p>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={handleReset}>
            Create another transaction
          </Button>
        </div>
      </Card>
    )
  }

  // ── Wizard ────────────────────────────────────────────────────────────────
  return (
    <Card className="w-full overflow-hidden">
      <StepProgress current={step} />

      <div className="overflow-hidden border-t border-border/50">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {/* ── Step 1: Info ────────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5 px-5 py-5">
                <div className="flex flex-col items-center gap-2 pb-1">
                  <IllustrationInfo />
                  <p className="text-center text-sm font-semibold text-foreground">Name your transaction</p>
                  <p className="text-center text-xs text-muted-foreground">Give this a clear reference so you can find it later.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    placeholder="e.g. Rental #104 — BMW X5, 3 days"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setStepError(null) }}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">
                    Internal notes{" "}
                    <span className="text-xs font-normal text-muted-foreground">(private, not shown to client)</span>
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Any internal reference or reminders…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[72px] resize-none text-sm"
                  />
                </div>
              </div>
            )}

            {/* ── Step 2: Payment ──────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4 px-5 py-5">
                <div className="flex flex-col items-center gap-2 pb-1">
                  <IllustrationPayment />
                  <p className="text-center text-sm font-semibold text-foreground">Set up payment</p>
                  <p className="text-center text-xs text-muted-foreground">
                    At least one amount is required. Both can be combined.
                  </p>
                </div>

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

                {/* Deposit Hold */}
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Wallet className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        Security Deposit
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">PRIMARY</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Card held — <strong>not charged</strong>. Captured or released after the job.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="depositAmount" className="text-xs">Hold Amount (EUR)</Label>
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
                    {depositNum > 0 && (
                      <div className="rounded-lg border border-border/50 bg-background/60 p-2.5 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Hold amount</span>
                          <span className="font-medium text-foreground">€{depositNum.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Platform fee (2% + €0.25)</span>
                          <span>€{platformFee.toFixed(2)}</span>
                        </div>
                        <div className="mt-1.5 border-t border-border/40 pt-1.5 text-xs text-muted-foreground">
                          If captured: you receive <strong>€{(depositNum - platformFee).toFixed(2)}</strong>. If released: client is not charged.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Service Payment */}
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <CreditCard className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        Service Payment
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">OPTIONAL</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Charged immediately. You receive amount minus ~1.4% + €0.25 Stripe fees.</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
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
                    {amountNum > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Client pays <strong>€{amountNum.toFixed(2)}</strong> — you receive approx. <strong>€{(amountNum - amountNum * 0.014 - 0.25).toFixed(2)}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Kind badge */}
                {txKind && (
                  <div className="flex justify-center">
                    <span className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-foreground">
                      {KIND_LABELS[txKind]}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 3: Documents ────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-5 px-5 py-5">
                <div className="flex flex-col items-center gap-2 pb-1">
                  <IllustrationDocuments />
                  <p className="text-center text-sm font-semibold text-foreground">Documents &amp; verification</p>
                  <p className="text-center text-xs text-muted-foreground">All fields are optional — skip any that don&apos;t apply.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checklist" className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    Required Uploads
                  </Label>
                  <Select value={checklistId} onValueChange={setChecklistId}>
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

                <div className="space-y-2">
                  <Label htmlFor="contract" className="flex items-center gap-1.5">
                    <FileText className="size-3.5 text-muted-foreground" />
                    Contract Template
                  </Label>
                  <Select value={contractId} onValueChange={setContractId}>
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

                <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/60">
                      <ShieldCheck className="size-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Require ID document</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Client uploads a government-issued photo ID. You review it from the transaction detail page.
                      </p>
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
                    disabled={financeDisabled}
                    className="mt-0.5 shrink-0"
                  />
                </div>
              </div>
            )}

            {/* ── Step 4: Review ────────────────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-4 px-5 py-5">
                <div className="flex flex-col items-center gap-2 pb-1">
                  <IllustrationReview />
                  <p className="text-center text-sm font-semibold text-foreground">Ready to launch</p>
                  <p className="text-center text-xs text-muted-foreground">Review your setup and generate the secure client link.</p>
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-border/60 bg-muted/20 divide-y divide-border/40 text-sm">
                  <div className="flex items-start justify-between px-4 py-3">
                    <span className="text-muted-foreground">Title</span>
                    <span className="ml-4 max-w-[180px] truncate text-right font-medium text-foreground">{title || "—"}</span>
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
                      <span className="ml-4 max-w-[160px] truncate text-right font-medium text-foreground">{contractLabel}</span>
                    </div>
                  )}

                  {checklistId !== "none" && (
                    <div className="flex items-start justify-between px-4 py-3">
                      <span className="text-muted-foreground">Uploads</span>
                      <span className="ml-4 max-w-[160px] truncate text-right font-medium text-foreground">{checklistLabel}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-muted-foreground">ID verification</span>
                    <span className={cn("font-medium", requiresKyc ? "text-foreground" : "text-muted-foreground")}>
                      {requiresKyc ? "Required" : "Not required"}
                    </span>
                  </div>
                </div>

                {/* Client flow preview */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client will see</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {clientSteps.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-1.5">
                        <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
                          {s.label}
                        </span>
                        {i < clientSteps.length - 1 && (
                          <ArrowRight className="size-3 shrink-0 text-muted-foreground/50" />
                        )}
                      </div>
                    ))}
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
      <div className="flex items-center gap-2 border-t border-border/60 px-5 py-4">
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
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
            className="flex-1 bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
            onClick={handleNext}
          >
            Next
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1 bg-(--contrazy-navy) text-white hover:bg-(--contrazy-navy-soft)"
            disabled={isPending || !title.trim() || !canLaunch}
            onClick={handleSubmit}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <LinkIcon className="mr-2 size-4" />
            )}
            {isPending ? "Creating…" : "Generate Secure Link"}
          </Button>
        )}
      </div>
    </Card>
  )
}
