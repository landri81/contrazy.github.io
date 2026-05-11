"use client"

import { useEffect } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { useRouter } from "@/i18n/navigation"

export function ClientProcessingCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const t = useTranslations("clientFlow.processingCard")
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      router.refresh()
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [router])

  return (
    <motion.section
      role="status"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="border border-border bg-background text-foreground"
    >
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-[var(--contrazy-teal)]">
            <Loader2 className="size-4 animate-spin" />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Processing
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 bg-muted/20 px-4 py-3 sm:px-5">
        <p className="text-xs leading-5 text-muted-foreground">
          This page refreshes automatically every 3 seconds.
        </p>

        <Button
          type="button"
          variant="outline"
          className="h-9 cursor-pointer rounded-sm border-border bg-background shadow-none focus-visible:ring-1 focus-visible:ring-[var(--contrazy-teal)] focus-visible:ring-offset-0"
          onClick={() => router.refresh()}
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          {t("refreshBtn")}
        </Button>
      </div>
    </motion.section>
  )
}