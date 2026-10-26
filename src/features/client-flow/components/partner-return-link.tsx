"use client"

import { useEffect, useReducer } from "react"
import { useReducedMotion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  initialPartnerReturnCountdown,
  PARTNER_RETURN_COUNTDOWN_SECONDS,
  partnerReturnCountdownReducer,
} from "@/features/client-flow/partner-return-countdown"
import type { PartnerReturnTarget } from "@/lib/partner-api/return-link"
import { cn } from "@/lib/utils"

/**
 * Primary "Return to <partner>" button for partner bookings, with a visible
 * 5 s countdown and automatic redirect. The customer can stop the countdown.
 * With `prefers-reduced-motion` there is no countdown and no automatic
 * redirect. Nothing counts down until the preference is known, so the server
 * render shows the button only.
 */
export function PartnerReturnLink({ href, partnerName, className }: PartnerReturnTarget & { className?: string }) {
  const t = useTranslations("clientFlow.partnerReturn")
  const reduceMotion = useReducedMotion()
  const [state, dispatch] = useReducer(partnerReturnCountdownReducer, initialPartnerReturnCountdown)

  useEffect(() => {
    if (reduceMotion === null) {
      return
    }

    dispatch({ type: "start", reducedMotion: reduceMotion })
  }, [reduceMotion])

  useEffect(() => {
    if (state.phase !== "counting") {
      return
    }

    const timer = window.setTimeout(() => dispatch({ type: "tick" }), 1000)
    return () => window.clearTimeout(timer)
  }, [state.phase, state.remaining])

  useEffect(() => {
    if (state.phase === "redirecting") {
      window.location.assign(href)
    }
  }, [state.phase, href])

  const counting = state.phase === "counting" || state.phase === "redirecting"
  const announcement = counting
    ? t("announcement", { partnerName, seconds: PARTNER_RETURN_COUNTDOWN_SECONDS })
    : state.phase === "stopped"
      ? t("stopped", { partnerName })
      : ""

  return (
    <div className={cn("space-y-3", className)}>
      <a
        href={href}
        className={cn(buttonVariants({ size: "lg" }), "h-11 w-full text-base")}
        data-testid="partner-return-link"
      >
        {t("button", { partnerName })}
        <ChevronRight className="ml-1 size-4" />
      </a>

      {counting ? (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span aria-hidden="true" className="tabular-nums" data-testid="partner-return-countdown">
            {t("countdown", { partnerName, seconds: state.remaining })}
          </span>
          <Button type="button" variant="link" size="sm" className="h-auto px-1" onClick={() => dispatch({ type: "stop" })}>
            {t("stay")}
          </Button>
        </div>
      ) : null}

      {state.phase === "stopped" ? (
        <p className="text-sm text-muted-foreground" aria-hidden="true">
          {t("stopped", { partnerName })}
        </p>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
