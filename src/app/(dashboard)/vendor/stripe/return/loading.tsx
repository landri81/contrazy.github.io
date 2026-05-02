import { Loader2 } from "lucide-react"

export default function StripeReturnLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-[var(--contrazy-teal)]/10">
        <Loader2 className="size-7 animate-spin text-[var(--contrazy-teal)]" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">Verifying your Stripe account…</p>
        <p className="mt-1 text-sm text-muted-foreground">Please wait while we confirm your onboarding status.</p>
      </div>
    </div>
  )
}
