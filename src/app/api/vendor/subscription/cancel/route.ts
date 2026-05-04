import { NextResponse } from "next/server"

import { cancelSubscriptionAtPeriodEnd } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const subscription = await cancelSubscriptionAtPeriodEnd(vendorProfile.id)
    return NextResponse.json({ success: true, subscription })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel subscription."
    console.error("Cancel subscription error:", error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
