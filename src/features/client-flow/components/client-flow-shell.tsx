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
import { useTranslations } from "next-intl"

import { LocaleSwitcher } from "@/components/ui/locale-switcher"
import { ClientCancelLinkAction } from "@/features/client-flow/components/client-cancel-link-action"
import { usePathname } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type StepKey =
  | "profile"
  | "documents"
  | "kyc"
  | "contract"
  | "sign"
  | "payment"
  | "complete"

const stepOrder: StepKey[] = [
  "profile",
  "documents",
  "kyc",
  "contract",
  "sign",
  "payment",
  "complete",
]

const stepIcons: Record<StepKey, React.ComponentType<{ className?: string }>> = {
  profile: UserCircle,
  documents: Camera,
  kyc: ShieldCheck,
  contract: FileText,
  sign: PenLine,
  payment: CreditCard,
  complete: CheckCircle2,
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

const motionEase = [0.25, 0.46, 0.45, 0.94] as const

export function ClientFlowShell({
  vendorName,
  reference,
  token,
  canCancel,
  enabledSteps,
  completedSteps,
  children,
}: ClientFlowShellProps) {
  const tShell = useTranslations("clientFlow.shell")
  const tSteps = useTranslations("clientFlow.steps")
  const pathname = usePathname() ?? ""
  const reduceMotion = useReducedMotion()

  const stepLabelMap: Record<StepKey, string> = {
    profile: tSteps("profile"),
    documents: tSteps("documents"),
    kyc: tSteps("kyc"),
    contract: tSteps("contract"),
    sign: tSteps("sign"),
    payment: tSteps("payment"),
    complete: tSteps("complete"),
  }

  const visibleSteps = stepOrder.filter((step) => enabledSteps.includes(step))
  const currentStep =
    visibleSteps.find((step) => pathname.endsWith(`/${step}`)) ?? visibleSteps[0]
  const currentIndex = Math.max(0, visibleSteps.indexOf(currentStep))
  const CurrentIcon = currentStep ? stepIcons[currentStep] : UserCircle

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 supports-backdrop-filter:backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-[var(--contrazy-navy)] text-white"
            >
              <span className="text-xs font-extrabold tracking-tight">
                C<span className="text-[var(--contrazy-teal)]">t</span>
              </span>
            </div>

            <div className="min-w-0 leading-tight">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tShell("vendor")}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">{vendorName}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <LocaleSwitcher variant="light" />

            <div className="hidden h-5 w-px bg-border sm:block" />

            <div className="hidden items-center gap-1.5 rounded-sm border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground md:inline-flex">
              <LockKeyhole className="size-3.5 text-[var(--contrazy-teal)]" />
              {tShell("protectedSession")}
            </div>

            {reference ? (
              <div className="hidden border-l border-border pl-3 text-right leading-tight sm:block">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tShell("reference")}
                </p>
                <p className="max-w-28 truncate text-sm font-medium text-foreground md:max-w-40">
                  {reference}
                </p>
              </div>
            ) : null}

            {canCancel ? <ClientCancelLinkAction token={token} /> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-5 sm:py-5">
        <section className="border-b border-border pb-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-sm border border-border bg-muted px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <LockKeyhole className="size-3.5 text-[var(--contrazy-teal)]" />
                {tShell("secureOnboarding")}
              </div>

              <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {tShell("completeRequest", { vendorName })}
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {tShell("progressSaved")}
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-3 rounded-sm border border-border bg-background px-3 py-2 md:min-w-64">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-[var(--contrazy-teal)]">
                <CurrentIcon className="size-4" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tShell("currentStep")}
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {currentStep ? stepLabelMap[currentStep] : "—"}
                </p>
              </div>
              <div className="ml-auto shrink-0 rounded-full border border-[var(--contrazy-teal)]/30 bg-[var(--contrazy-teal)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--contrazy-teal)]">
                {tShell("stepOf", {
                  current: currentIndex + 1,
                  total: visibleSteps.length,
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="sticky top-[57px] z-30 border-b border-border bg-background/95 py-3 supports-backdrop-filter:backdrop-blur sm:top-[57px]">
          <ProgressStepper
            steps={visibleSteps}
            currentIndex={currentIndex}
            completed={completedSteps}
            labelMap={stepLabelMap}
          />
        </div>

        <section className="min-w-0 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: motionEase }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  )
}

function ProgressStepper({
  steps,
  currentIndex,
  completed,
  labelMap,
}: {
  steps: StepKey[]
  currentIndex: number
  completed: StepKey[]
  labelMap: Record<StepKey, string>
}) {
  if (steps.length === 0) return null

  const safeIndex = Math.max(0, currentIndex)
  const currentStep = steps[safeIndex]

  return (
    <nav aria-label="Client onboarding progress">
      <ol className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin-subtle sm:overflow-visible sm:pb-0">
        {steps.map((step, index) => {
          const Icon = stepIcons[step]
          const isCompleted = completed.includes(step) || index < safeIndex
          const isCurrent = index === safeIndex

          return (
            <li key={step} className="flex min-w-0 flex-1 items-center gap-2 first:min-w-fit">
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex h-8 min-w-fit items-center gap-2 rounded-sm px-2 text-xs font-semibold transition-colors",
                  isCurrent
                    ? "bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px]",
                    isCompleted
                      ? "border-[var(--contrazy-teal)] bg-[var(--contrazy-teal)] text-white"
                      : isCurrent
                        ? "border-[var(--contrazy-teal)] text-[var(--contrazy-teal)]"
                        : "border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="size-3" /> : <Icon className="size-3" />}
                </span>
                <span className="hidden max-w-24 truncate sm:block">{labelMap[step]}</span>
              </div>

              {index < steps.length - 1 ? (
                <span aria-hidden="true" className="h-px min-w-5 flex-1 bg-border" />
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="mt-2 flex items-center justify-between border border-border bg-muted/30 px-3 py-2 sm:hidden">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">
          {labelMap[currentStep]}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {safeIndex + 1} / {steps.length}
          <ArrowRight className="size-3" />
        </span>
      </div>
    </nav>
  )
}
