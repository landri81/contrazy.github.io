"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Ban, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ClientLinkCancelledState({
  vendorName,
  reason,
}: {
  vendorName?: string | null
  reason?: string | null
}) {
  const t = useTranslations("clientFlow")

  return (
    <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-red-100 p-4 dark:bg-red-950/40">
          <Ban className="h-12 w-12 text-red-600 dark:text-red-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("cancelled.title")}</h1>
        <p className="text-muted-foreground">
          {vendorName
            ? t("cancelled.message", { vendorName })
            : t("cancelled.messageNoVendor")}
        </p>
        {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
      </div>

      <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}>
        {t("finish.returnHome")}
        <ChevronRight className="ml-2 h-4 w-4" />
      </Link>
    </div>
  )
}
