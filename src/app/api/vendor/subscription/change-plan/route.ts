import { NextResponse } from "next/server"
import { SubscriptionBillingInterval, SubscriptionPlanKey } from "@prisma/client"

import {
  parseSubscriptionBillingInterval,
  parseSubscriptionPlanKey,
} from "@/features/subscriptions/config"
import {
  changePlan,
  toSubscriptionBillingInterval,
  toSubscriptionPlanKey,
} from "@/features/subscriptions/server/subscription-management"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()

    const body = await request.json()
    const planSlug = parseSubscriptionPlanKey(body?.planKey)
    const intervalSlug = parseSubscriptionBillingInterval(body?.billingInterval)

    if (!planSlug || !intervalSlug) {
      return NextResponse.json(
        { success: false, message: "Select a valid plan and billing interval." },
        { status: 422 }
      )
    }

    if (planSlug === "enterprise") {
      return NextResponse.json(
        { success: false, message: "Enterprise plans are managed through sales. Contact us." },
        { status: 422 }
      )
    }

    const planKey = toSubscriptionPlanKey(planSlug) ?? SubscriptionPlanKey.STARTER
    const billingInterval = toSubscriptionBillingInterval(intervalSlug) ?? SubscriptionBillingInterval.MONTHLY

    const result = await changePlan(vendorProfile.id, planKey, billingInterval)

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to change plan."
    console.error("Change plan error:", error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
