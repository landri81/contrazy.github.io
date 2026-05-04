import { NextResponse } from "next/server"

import { createPaymentMethodSetupIntent } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const clientSecret = await createPaymentMethodSetupIntent(vendorProfile.id)
    return NextResponse.json({ success: true, clientSecret })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start payment method update."
    console.error("Setup intent error:", error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
