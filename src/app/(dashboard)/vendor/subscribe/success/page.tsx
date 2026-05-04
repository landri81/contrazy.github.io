import { CheckCircle2 } from "lucide-react"

import { SubscriptionStatusPoll } from "@/features/subscriptions/components/subscription-status-poll"
import { getVendorSubscriptionAccessState } from "@/features/subscriptions/server/subscription-service"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export default async function VendorSubscribeSuccessPage({
 
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { vendorProfile } = await requireVendorProfileAccess()
  const accessState = await getVendorSubscriptionAccessState(vendorProfile.id)
 
  return (
    <div className="mx-auto space-y-4 sm:space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top_right,rgba(17,201,176,0.14),transparent_16rem),linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.96))] shadow-sm">
        <div className="p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-[24px] bg-emerald-100 text-emerald-700 shadow-sm ring-1 ring-emerald-200/70">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm">
              Success
            </div>

            <h1 className="mt-4 text-[1.85rem] font-bold tracking-tight text-foreground sm:text-[2.25rem]">
              Congratulations!
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Your checkout has been completed successfully. Your account is being
              prepared, and access will be available shortly.
            </p>

            <div className="mt-6 rounded-2xl border border-border/70 bg-background/85 px-4 py-3 shadow-sm">
              <p className="text-sm font-semibold text-foreground">
                Thank you for joining Contrazy.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                You can continue once your workspace access is ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SubscriptionStatusPoll initialAllowed={accessState.allowed} />
    </div>
  )
}
