import { NextResponse } from "next/server"

import { getBillingWorkspace } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const workspace = await getBillingWorkspace(vendorProfile.id)
    return NextResponse.json({ success: true, workspace })
  } catch (error) {
    console.error("Billing workspace error:", error)
    return NextResponse.json({ success: false, message: "Failed to load billing workspace." }, { status: 500 })
  }
}
