import Stripe from "stripe"

import { env } from "@/lib/env"

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  appInfo: {
    name: "Conntrazy",
    version: "week1-foundation",
  },
})

export function getAppBaseUrl() {
  return env.NEXT_PUBLIC_APP_URL ?? env.NEXTAUTH_URL ?? "http://localhost:3000"
}

export function getConnectedAccountRequestOptions(stripeAccountId?: string | null): Stripe.RequestOptions | undefined {
  if (!stripeAccountId) {
    return undefined
  }

  return { stripeAccount: stripeAccountId }
}
