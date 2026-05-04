"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"

type SubscriptionPollState = {
  allowed: boolean
  reason: string
  subscription: {
    planKey: string
    billingInterval: string
    status: string
  } | null
}

export function SubscriptionStatusPoll({
  initialAllowed,
}: {
  initialAllowed: boolean
}) {
  const router = useRouter()
  const [state, setState] = useState<SubscriptionPollState | null>(null)
  const [isLoading, setIsLoading] = useState(!initialAllowed)

  useEffect(() => {
    if (initialAllowed) {
      return
    }

    let active = true
    const poll = async () => {
      try {
        const response = await fetch("/api/vendor/subscription/status", {
          cache: "no-store",
        })

        const data = await response.json()

        if (!active) {
          return
        }

        setState({
          allowed: Boolean(data?.allowed),
          reason: data?.reason ?? "inactive",
          subscription: data?.subscription ?? null,
        })
        setIsLoading(false)

        if (data?.allowed) {
          router.refresh()
        }
      } catch {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    poll()
    const intervalId = window.setInterval(poll, 3500)

    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [initialAllowed, router])

  const allowed = initialAllowed || state?.allowed

  if (allowed) {
    return (
      <div className="rounded-[26px] border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.95),rgba(240,253,250,1))] p-4 text-emerald-900 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-emerald-700 shadow-sm ring-1 ring-emerald-200/70">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-base font-semibold text-foreground">
                Subscription confirmed
              </p>
              <p className="mt-1 text-sm leading-6 text-emerald-800/85">
                Your workspace is active now. You can continue directly to the vendor dashboard.
              </p>
            </div>
            <Link
              href="/vendor"
              className={buttonVariants({
                className:
                  "h-10 rounded-xl bg-[var(--contrazy-teal)] px-4 text-white hover:bg-[#0eb8a0]",
              })}
            >
              Open workspace
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[26px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-foreground shadow-sm ring-1 ring-border/70">
          <Loader2 className={`size-4.5 ${isLoading ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-base font-semibold text-foreground">
              Waiting for Stripe confirmation
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Your checkout is complete. This page will unlock the workspace as soon as the subscription webhook is recorded.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/85 p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {isLoading ? "Checking Stripe" : "Awaiting webhook"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/85 p-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Refresh
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Every 3.5 seconds
              </p>
            </div>
          </div>

          <Button variant="outline" className="h-10 rounded-xl" onClick={() => router.refresh()}>
            Check again
          </Button>
        </div>
      </div>
    </div>
  )
}
