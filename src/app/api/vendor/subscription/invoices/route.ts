import { NextResponse } from "next/server"

import { fetchInvoices } from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit") ?? "12"), 50)

    const subscription = await prisma.vendorSubscription.findUnique({
      where: { vendorId: vendorProfile.id },
      select: { stripeCustomerId: true },
    })

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json({ success: true, invoices: [] })
    }

    const invoices = await fetchInvoices(subscription.stripeCustomerId, limit)
    return NextResponse.json({ success: true, invoices })
  } catch (error) {
    console.error("Invoices error:", error)
    return NextResponse.json({ success: false, message: "Failed to load invoices." }, { status: 500 })
  }
}
