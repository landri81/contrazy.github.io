import { CheckCircle2 } from "lucide-react"

import { SubscriptionStatusPoll } from "@/features/subscriptions/components/subscription-status-poll"
import { getVendorSubscriptionAccessState } from "@/features/subscriptions/server/subscription-service"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const dynamic = "force-dynamic"

export default async function VendorSubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { vendorProfile } = await requireVendorProfileAccess()
  const accessState = await getVendorSubscriptionAccessState(vendorProfile.id)
  const { session_id } = await searchParams

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-[28px] border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Checkout received</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Stripe sent you back successfully. Access is unlocked only after the subscription status is confirmed in the database by the billing webhook.
            </p>
            {session_id ? (
              <p className="mt-3 text-xs text-muted-foreground">Session: {session_id}</p>
            ) : null}
          </div>
        </div>
      </section>

      <SubscriptionStatusPoll initialAllowed={accessState.allowed} />
    </div>
  )
}
