import Stripe from "stripe"

import { APP_METADATA } from "@/lib/config/app-metadata"
import { env } from "@/lib/env"
import { getSiteUrl } from "@/lib/site-url"

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  appInfo: {
    name: APP_METADATA.productName,
    version: APP_METADATA.version,
  },
})

export function getStripePublishableKey() {
  return env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? env.STRIPE_PUBLISHABLE_KEY
}

export function getAppBaseUrl() {
  return getSiteUrl()
}

export function getConnectedAccountRequestOptions(stripeAccountId?: string | null): Stripe.RequestOptions | undefined {
  if (!stripeAccountId) {
    return undefined
  }

  return { stripeAccount: stripeAccountId }
}
