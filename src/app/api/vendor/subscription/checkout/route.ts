import { NextResponse } from "next/server"
import { SubscriptionBillingInterval, SubscriptionPlanKey } from "@prisma/client"

import {
  parseSubscriptionBillingInterval,
  parseSubscriptionPlanKey,
} from "@/features/subscriptions/config"
import { getSubscriptionPlanPriceId, getSubscriptionTrialConfig } from "@/features/subscriptions/server/subscription-billing"
import { resolveCheckoutEligibility } from "@/features/subscriptions/server/subscription-management"
import {
  getOrCreateSubscriptionCustomer,
  getVendorSubscriptionAccessState,
  toSubscriptionBillingInterval,
  toSubscriptionPlanKey,
} from "@/features/subscriptions/server/subscription-service"
import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { getAppBaseUrl, stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { session, dbUser, vendorProfile } = await requireVendorProfileAccess()
    const accessState = await getVendorSubscriptionAccessState(vendorProfile.id)
    const eligibility = resolveCheckoutEligibility(accessState.subscription)

    if (!eligibility.eligible) {
      if (eligibility.reason === "recovery_required") {
        return NextResponse.json(
          {
            success: false,
            code: "RECOVERY_REQUIRED",
            redirectTo: "/vendor/billing",
            message: "Your subscription has a payment issue. Please resolve it from your billing page.",
          },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, message: "Your workspace already has an active subscription." },
        { status: 409 }
      )
    }

    const body = await request.json()
    const planSlug = parseSubscriptionPlanKey(body?.planKey)
    const intervalSlug = parseSubscriptionBillingInterval(body?.billingInterval)

    if (!planSlug || !intervalSlug) {
      return NextResponse.json(
        { success: false, message: "Select a valid subscription plan and billing interval." },
        { status: 422 }
      )
    }

    if (planSlug === "enterprise") {
      return NextResponse.json(
        { success: false, message: "Enterprise onboarding is handled through contact sales." },
        { status: 422 }
      )
    }

    const planKey = toSubscriptionPlanKey(planSlug) ?? SubscriptionPlanKey.STARTER
    const billingInterval =
      toSubscriptionBillingInterval(intervalSlug) ?? SubscriptionBillingInterval.MONTHLY
    const priceId = getSubscriptionPlanPriceId(planKey, billingInterval)
    const trialConfig = getSubscriptionTrialConfig(planKey)
    const { customerId } = await getOrCreateSubscriptionCustomer({
      vendorProfile: {
        id: vendorProfile.id,
        businessName: vendorProfile.businessName,
        businessEmail: vendorProfile.businessEmail,
      },
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      },
    })

    const origin = getAppBaseUrl()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      locale: "fr",
      metadata: {
        vendorId: vendorProfile.id,
        userId: dbUser.id,
        planKey: planSlug,
        billingInterval: intervalSlug,
        role: session.user.role ?? "VENDOR",
      },
      subscription_data: {
        metadata: {
          vendorId: vendorProfile.id,
          userId: dbUser.id,
          planKey: planSlug,
          billingInterval: intervalSlug,
        },
        ...trialConfig,
      },
      success_url: `${origin}/vendor/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/vendor/subscribe?canceled=1`,
    })

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
    })
  } catch (error) {
    console.error("Vendor Subscription Checkout Error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to start subscription checkout." },
      { status: 500 }
    )
  }
}
