import { NextResponse } from "next/server"

import { attachPaymentMethod } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { paymentMethodId } = await request.json() as { paymentMethodId?: string }

    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return NextResponse.json({ success: false, message: "paymentMethodId is required." }, { status: 422 })
    }

    await attachPaymentMethod(vendorProfile.id, paymentMethodId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update payment method."
    console.error("Attach payment method error:", error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
