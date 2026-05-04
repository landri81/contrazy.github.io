"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
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
  const reduceMotion = useReducedMotion()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(17,201,176,0.13),transparent_32rem),linear-gradient(180deg,#f8fafc_0%,#eef3f7_100%)] text-foreground">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--contrazy-navy)] text-white shadow-sm shadow-slate-900/15">
              <span className="text-sm font-extrabold tracking-tight">
                C<span className="text-[var(--contrazy-teal)]">t</span>
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vendor</p>
              <p className="text-sm font-semibold text-foreground">{vendorName}</p>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <LockKeyhole className="size-3.5" />
              Protected session
            </div>
            {canCancel ? <ClientCancelLinkAction token={token} /> : null}
            {reference ? (
              <div className="text-right leading-tight">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reference</p>
                <p className="text-sm font-medium text-foreground">{reference}</p>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 md:hidden">
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

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8 lg:py-8">
        <motion.aside
          initial={reduceMotion ? false : { opacity: 0, x: -18 }}
          animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="client-flow-sidebar relative hidden overflow-hidden rounded-lg bg-[var(--contrazy-navy)] p-5 text-white shadow-xl shadow-slate-900/15 lg:sticky lg:top-24 lg:block lg:h-[calc(100dvh-8rem)]"
        >
          <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_20%_0%,rgba(17,201,176,0.32),transparent_18rem)]" />
          <div className="client-flow-sidebar-inner scrollbar-thin-subtle relative flex h-full flex-col overflow-y-auto pr-1">
            <div className="client-flow-sidebar-badge inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
              <LockKeyhole className="size-3.5 text-[var(--contrazy-teal)]" />
              Secure onboarding
            </div>

            <div className="client-flow-sidebar-intro mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">Transaction</p>
              <h1 className="client-flow-sidebar-title mt-3 font-heading text-3xl font-semibold leading-tight text-white">
                Complete your request with {vendorName}
              </h1>
              <p className="client-flow-sidebar-copy mt-4 text-sm leading-6 text-white/65">
                Follow each step in order. Your progress is saved as you move through the secure flow.
              </p>
            </div>

            <div className="client-flow-sidebar-summary mt-8 flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.07] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs uppercase tracking-[0.18em] text-white/45">Current step</span>
                <span className="text-sm font-semibold text-[var(--contrazy-teal)]">{currentIndex + 1} of {visibleSteps.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-white/10">
                  {(() => {
                    const Icon = stepIcons[currentStep]
                    return <Icon className="size-4 text-[var(--contrazy-teal)]" />
                  })()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{stepLabels[currentStep]}</p>
                  {reference ? <p className="client-flow-sidebar-reference text-xs text-white/50">Reference {reference}</p> : null}
                </div>
              </div>
            </div>

            <div className="client-flow-sidebar-steps mt-auto hidden flex-col gap-3 pt-8 lg:flex">
              {visibleSteps.slice(0, 4).map((step, index) => {
                const isCurrent = step === currentStep
                const isDone = completedSteps.includes(step) || index < currentIndex

                return (
                  <div key={step} className="client-flow-sidebar-step flex items-center gap-3 text-sm">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full border text-[11px] font-bold",
                        isDone
                          ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-[var(--contrazy-navy)]"
                          : isCurrent
                            ? "border-white/40 bg-white/10 text-white"
                            : "border-white/15 text-white/45"
                      )}
                    >
                      {isDone ? <Check className="size-3" /> : index + 1}
                    </span>
                    <span className={cn(isCurrent ? "text-white" : isDone ? "text-white/75" : "text-white/45")}>
                      {stepLabels[step]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.aside>

        <section className="min-w-0">
          <ProgressStepper steps={visibleSteps} currentIndex={currentIndex} completed={completedSteps} />

          <div className="relative mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>
      </main>
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

  const safeIndex = Math.max(0, currentIndex)
  const progressPercent = steps.length === 1 ? 100 : (safeIndex / (steps.length - 1)) * 100
  const currentStep = steps[currentIndex]
  const trackInset = `${100 / (steps.length * 2)}%`
  const trackLength = `${100 - 100 / steps.length}%`

  return (
    <div className="rounded-lg border border-white bg-white/85 p-4 shadow-sm shadow-slate-900/5 backdrop-blur-sm sm:p-5">
      <div className="relative">
        <div
          className="absolute top-4 h-1 rounded-full bg-slate-200 sm:top-[18px]"
          style={{ left: trackInset, right: trackInset }}
        />
        <motion.div
          className="absolute top-4 h-1 rounded-full bg-[var(--contrazy-teal)] sm:top-[18px]"
          style={{ left: trackInset }}
          initial={false}
          animate={{ width: `calc(${trackLength} * ${progressPercent / 100})` }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((step, index) => {
            const Icon = stepIcons[step]
            const isCompleted = completed.includes(step) || index < currentIndex
            const isCurrent = index === currentIndex

            return (
              <div key={step} className="flex min-w-0 flex-col items-center gap-2">
                <motion.div
                  initial={false}
                  animate={{ scale: isCurrent ? 1.08 : 1 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors sm:size-9",
                    isCompleted
                      ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-white shadow-sm shadow-emerald-500/25"
                      : isCurrent
                        ? "border-[var(--contrazy-teal)] bg-white text-[var(--contrazy-teal)] shadow-md shadow-emerald-500/20"
                        : "border-slate-200 bg-white text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="size-3" /> : <Icon className="size-3 sm:size-3.5" />}
                </motion.div>
                <span
                  className={cn(
                    "hidden max-w-20 truncate text-center text-[10px] font-semibold uppercase tracking-[0.08em] sm:block",
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
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 sm:hidden">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
          {stepLabels[currentStep]}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {currentIndex + 1} / {steps.length}
          <ArrowRight className="size-3" />
        </span>
      </div>
    </div>
  )
}
