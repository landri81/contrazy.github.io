"use client"

import { motion } from "framer-motion"
import { Loader2, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { AuthLayout } from "@/features/auth/components/auth-layout"

export function AuthCompleteLoadingState() {
  const t = useTranslations("auth.complete")

  return (
    <AuthLayout title={t("title")} subtitle={t("subtitle")}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-4"
      >
        <div className="rounded-[24px] border border-border/70 bg-muted/30 p-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--contrazy-teal)]/12 text-[var(--contrazy-teal)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
            <Loader2 className="size-6 animate-spin" />
          </div>

          <h2 className="mt-4 text-base font-semibold tracking-tight text-foreground">
            {t("statusTitle")}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {t("statusDescription")}
          </p>

          <div className="mt-5 grid gap-2 text-left">
            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/85 px-3.5 py-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--contrazy-teal)]/10 text-[var(--contrazy-teal)]">
                <ShieldCheck className="size-4" />
              </div>
              <p className="text-sm text-foreground">{t("checkingSession")}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                animate={{ x: ["-35%", "105%"] }}
                transition={{ duration: 1.2, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
                className="h-full w-1/3 rounded-full bg-[var(--contrazy-teal)]/65"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AuthLayout>
  )
}
