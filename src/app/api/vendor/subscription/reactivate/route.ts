import { NextResponse } from "next/server"

import { reactivateSubscription } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const subscription = await reactivateSubscription(vendorProfile.id)
    return NextResponse.json({ success: true, subscription })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reactivate subscription."
    console.error("Reactivate subscription error:", error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
