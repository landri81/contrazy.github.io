import { NextResponse } from "next/server"
import { ensureVendorApproved, ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { getAppBaseUrl, stripe } from "@/lib/integrations/stripe"

export async function DELETE() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    if (!vendorProfile.stripeAccountId) {
      return NextResponse.json({ message: "No Stripe account linked." }, { status: 400 })
    }

    // Block disconnect if there are active (non-terminal) transactions with payment intents
    const activeCount = await prisma.transaction.count({
      where: {
        vendorId: vendorProfile.id,
        stripePaymentIntentId: { not: null },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    })

    if (activeCount > 0) {
      return NextResponse.json(
        {
          message: `You have ${activeCount} active transaction${activeCount > 1 ? "s" : ""} with pending payments. Complete or cancel them before disconnecting Stripe.`,
        },
        { status: 409 },
      )
    }

    // Clear the Stripe association in our DB — we do NOT delete the Stripe account
    // itself because it belongs to the vendor and may have historical data.
    await prisma.vendorProfile.update({
      where: { id: vendorProfile.id },
      data: {
        stripeAccountId: null,
        stripeConnectionStatus: "NOT_CONNECTED",
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Stripe Disconnect Error:", error)
    return NextResponse.json({ message: "Failed to disconnect Stripe account." }, { status: 500 })
  }
}

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST() {
  try {
    const { dbUser, vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const blockedResponse = ensureVendorApproved(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const profileId = vendorProfile.id
    let stripeAccountId = vendorProfile.stripeAccountId

    // If the vendor does not have a connected Stripe account yet, create one
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: dbUser.email,
        business_profile: {
          name: vendorProfile.businessName || undefined,
        },
      })

      stripeAccountId = account.id

      // Save the account ID to the profile
      await prisma.vendorProfile.update({
        where: { id: profileId },
        data: { stripeAccountId },
      })
    }

    // Generate account link for onboarding
    const origin = getAppBaseUrl()
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/vendor/stripe/refresh`,
      return_url: `${origin}/vendor/stripe/return`,
      type: "account_onboarding",
    })

    return NextResponse.json({
      success: true,
      url: accountLink.url,
    })
  } catch (error) {
    console.error("Stripe Connect Error:", error)
    return NextResponse.json(
      { success: false, message: "Failed to initialize Stripe Connect" },
      { status: 500 }
    )
  }
}
