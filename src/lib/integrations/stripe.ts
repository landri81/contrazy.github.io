import Stripe from "stripe"

import { env } from "@/lib/env"

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  appInfo: {
    name: "Conntrazy",
    version: "week1-foundation",
  },
})
