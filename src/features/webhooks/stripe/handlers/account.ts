import type Stripe from "stripe"

import { prisma } from "@/lib/db/prisma"
import type { WebhookHandlerResult } from "@/features/webhooks/stripe/types"

export async function handleAccountUpdated(
  account: Stripe.Account,
  eventId: string,
  eventType: string,
): Promise<WebhookHandlerResult> {
  void eventId
  void eventType

  const vendorProfile = await prisma.vendorProfile.findFirst({
    where: { stripeAccountId: account.id },
    select: { id: true, userId: true },
  })

  if (!vendorProfile) {
    return { vendorId: null, transactionId: null }
  }

  let newStatus: "CONNECTED" | "PENDING" | "ERROR"

  if (account.requirements?.disabled_reason) {
    // Account has been restricted or disabled by Stripe
    newStatus = "ERROR"
  } else if (account.details_submitted) {
    newStatus = "CONNECTED"
  } else {
    newStatus = "PENDING"
  }

  await prisma.vendorProfile.update({
    where: { id: vendorProfile.id },
    data: { stripeConnectionStatus: newStatus },
  })

  return { vendorId: vendorProfile.id, transactionId: null }
}
