"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  LockKeyhole,
  PenLine,
  ShieldCheck,
  UserCircle,
} from "lucide-react"
import { usePathname } from "next/navigation"

import { ClientCancelLinkAction } from "@/features/client-flow/components/client-cancel-link-action"
import { cn } from "@/lib/utils"

type StepKey = "profile" | "documents" | "kyc" | "contract" | "sign" | "payment" | "complete"

const stepOrder: StepKey[] = ["profile", "documents", "kyc", "contract", "sign", "payment", "complete"]

const stepIcons: Record<StepKey, React.ComponentType<{ className?: string }>> = {
  profile: UserCircle,
  documents: Camera,
  kyc: ShieldCheck,
  contract: FileText,
  sign: PenLine,
  payment: CreditCard,
  complete: CheckCircle2,
}

const stepLabels: Record<StepKey, string> = {
  profile: "Profile",
  documents: "Documents",
  kyc: "Identity",
  contract: "Agreement",
  sign: "Signature",
  payment: "Payment",
  complete: "Complete",
}

type ClientFlowShellProps = {
  vendorName: string
  reference: string | null
  token: string
  canCancel: boolean
  enabledSteps: StepKey[]
  completedSteps: StepKey[]
  children: React.ReactNode
}

export function ClientFlowShell({
  vendorName,
  reference,
  token,
  canCancel,
  enabledSteps,
  completedSteps,
  children,
}: ClientFlowShellProps) {
  const pathname = usePathname() ?? ""
  const visibleSteps = stepOrder.filter((step) => enabledSteps.includes(step))
  const currentStep = visibleSteps.find((step) => pathname.endsWith(`/${step}`)) ?? visibleSteps[0]
  const currentIndex = visibleSteps.indexOf(currentStep)

  return (
    <div className="min-h-screen bg-(--contrazy-bg-muted)">
      <header className="sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur-md dark:bg-background/85">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-(--contrazy-navy) text-white">
              <span className="text-sm font-extrabold tracking-tight">
                C<span className="text-(--contrazy-teal)">t</span>
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vendor</p>
              <p className="text-sm font-semibold text-foreground">{vendorName}</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <LockKeyhole className="size-3.5 text-(--contrazy-teal)" />
              Protected session
            </div>
            {canCancel ? <ClientCancelLinkAction token={token} /> : null}
            {reference ? (
              <div className="text-right leading-tight">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reference</p>
                <p className="text-sm font-medium text-foreground">{reference}</p>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 sm:hidden">
            {canCancel ? <ClientCancelLinkAction token={token} /> : null}
            {reference ? (
              <div className="text-right leading-tight">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Reference</p>
                <p className="text-sm font-medium text-foreground">{reference}</p>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6 sm:px-6">
        <ProgressStepper steps={visibleSteps} currentIndex={currentIndex} completed={completedSteps} />

        <div className="relative mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ProgressStepper({
  steps,
  currentIndex,
  completed,
}: {
  steps: StepKey[]
  currentIndex: number
  completed: StepKey[]
}) {
  if (steps.length === 0) return null

  const progressPercent = steps.length === 1 ? 100 : (currentIndex / (steps.length - 1)) * 100
  const currentStep = steps[currentIndex]

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="relative h-1 rounded-full bg-border">
        <motion.div
          className="h-1 rounded-full bg-[var(--contrazy-teal)]"
          initial={false}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Step row — icons only on mobile, icons + labels on sm+ */}
      <div className="flex items-center justify-between gap-0.5">
        {steps.map((step, index) => {
          const Icon = stepIcons[step]
          const isCompleted = completed.includes(step) || index < currentIndex
          const isCurrent = index === currentIndex

          return (
            <div key={step} className="flex flex-1 flex-col items-center gap-1">
              <motion.div
                initial={false}
                animate={{ scale: isCurrent ? 1.08 : 1 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:size-8",
                  isCompleted
                    ? "border-(--contrazy-teal) bg-[var(--contrazy-teal)] text-white"
                    : isCurrent
                      ? "border-(--contrazy-teal) bg-white text-(--contrazy-teal) shadow-sm dark:bg-card"
                      : "border-border bg-card text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="size-3" /> : <Icon className="size-3 sm:size-3.5" />}
              </motion.div>
              {/* Label: hidden on xs, visible on sm+ */}
              <span
                className={cn(
                  "hidden text-[10px] font-medium uppercase tracking-wider sm:block",
                  isCurrent
                    ? "text-foreground"
                    : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                )}
              >
                {stepLabels[step]}
              </span>
            </div>
          )
        })}
      </div>

      {/* Current step label on mobile only */}
      <div className="flex items-center justify-between sm:hidden">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
          {stepLabels[currentStep]}
        </span>
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} / {steps.length}
        </span>
      </div>
    </div>
  )
}
