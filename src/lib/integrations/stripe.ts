import Stripe from "stripe"

import { env } from "@/lib/env"

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  appInfo: {
    name: "Conntrazy",
    version: "week1-foundation",
  },
})

export function getAppBaseUrl() {
  if (env.NEXT_PUBLIC_APP_URL) {
    return env.NEXT_PUBLIC_APP_URL
  }

  if (env.NEXTAUTH_URL) {
    return env.NEXTAUTH_URL
  }

  if (env.VERCEL_URL) {
    return env.VERCEL_URL.startsWith("http") ? env.VERCEL_URL : `https://${env.VERCEL_URL}`
  }

  return "http://localhost:3000"
}

export function getConnectedAccountRequestOptions(stripeAccountId?: string | null): Stripe.RequestOptions | undefined {
  if (!stripeAccountId) {
    return undefined
  }

  return { stripeAccount: stripeAccountId }
}
