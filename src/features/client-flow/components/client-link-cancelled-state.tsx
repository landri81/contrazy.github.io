import Link from "next/link"
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
  return (
    <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
      <div className="flex justify-center">
        <div className="rounded-full bg-red-100 p-4 dark:bg-red-950/40">
          <Ban className="h-12 w-12 text-red-600 dark:text-red-400" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">This link is no longer available</h1>
        <p className="text-muted-foreground">
          {vendorName
            ? `The secure request from ${vendorName} has been cancelled and can no longer be used.`
            : "This secure request has been cancelled and can no longer be used."}
        </p>
        {reason ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
      </div>

      <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}>
        Return Home
        <ChevronRight className="ml-2 h-4 w-4" />
      </Link>
    </div>
  )
}
