import { NextResponse } from "next/server"

import { getVendorSubscriptionAccessState } from "@/features/subscriptions/server/subscription-service"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const accessState = await getVendorSubscriptionAccessState(vendorProfile.id)

    return NextResponse.json({
      success: true,
      allowed: accessState.allowed,
      reason: accessState.reason,
      subscription: accessState.subscription
        ? {
            id: accessState.subscription.id,
            planKey: accessState.subscription.planKey,
            billingInterval: accessState.subscription.billingInterval,
            status: accessState.subscription.status,
            currentPeriodEnd: accessState.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: accessState.subscription.cancelAtPeriodEnd,
          }
        : null,
    })
  } catch (error) {
    console.error("Vendor Subscription Status Error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to load subscription status." },
      { status: 500 }
    )
  }
}
