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
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-3">
            <div>
              <p className="font-semibold">Subscription confirmed</p>
              <p className="mt-1 text-sm text-emerald-700">
                Your vendor workspace is now active. You can continue to the dashboard.
              </p>
            </div>
            <Link
              href="/vendor"
              className={buttonVariants({ className: "bg-emerald-600 text-white hover:bg-emerald-700" })}
            >
              Open workspace
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Loader2 className={`mt-0.5 size-5 shrink-0 ${isLoading ? "animate-spin" : ""}`} />
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-foreground">Waiting for Stripe confirmation</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The checkout redirect was received. Access will unlock as soon as the billing webhook updates your workspace.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.refresh()}>
            Check again
          </Button>
        </div>
      </div>
    </div>
  )
}
