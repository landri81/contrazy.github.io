import { NextResponse } from "next/server"

import { ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { stripe } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    if (!vendorProfile.stripeAccountId) {
      return NextResponse.json(
        {
          code: "NO_STRIPE_ACCOUNT",
          message: "No Stripe account linked.",
        },
        { status: 400 }
      )
    }

    const session = await stripe.accountSessions.create({
      account: vendorProfile.stripeAccountId,
      components: {
        account_management: { enabled: true },
        notification_banner: {
          enabled: true,
          features: { external_account_collection: true },
        },
        account_onboarding: { enabled: true },
        balances: { enabled: true, features: { instant_payouts: true, standard_payouts: true } },
        payouts: { enabled: true, features: { instant_payouts: true, standard_payouts: true, edit_payout_schedule: true } },
        payments: { enabled: true, features: { refund_management: true, dispute_management: true, capture_payments: true } },
      },
    })

    return NextResponse.json({
      clientSecret: session.client_secret,
      message: "Stripe account session ready.",
    })
  } catch (error) {
    console.error("Account session error:", error)
    return NextResponse.json(
      {
        code: "ACCOUNT_SESSION_FAILED",
        message: "Failed to create account session.",
      },
      { status: 500 }
    )
  }
}
