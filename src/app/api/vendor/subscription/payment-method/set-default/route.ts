import { NextResponse } from "next/server"

import { setDefaultPaymentMethod } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const body = await request.json()
    const { paymentMethodId } = body

    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return NextResponse.json({ success: false, message: "paymentMethodId is required." }, { status: 422 })
    }

    await setDefaultPaymentMethod(vendorProfile.id, paymentMethodId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set default payment method."
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
