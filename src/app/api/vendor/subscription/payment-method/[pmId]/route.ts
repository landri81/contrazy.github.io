import { NextResponse } from "next/server"

import { deletePaymentMethod } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ pmId: string }> }
) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { pmId } = await params

    if (!pmId) {
      return NextResponse.json({ success: false, message: "Payment method ID is required." }, { status: 422 })
    }

    await deletePaymentMethod(vendorProfile.id, pmId)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete payment method."
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
