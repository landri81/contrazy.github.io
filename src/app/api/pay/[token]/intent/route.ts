import { chargeLinkPaymentIntent } from "@/features/card-security/server/charge-link"
import { chargeLinkResponse } from "@/features/card-security/server/charge-link-response"
import { getStripePublishableKey } from "@/lib/integrations/stripe"

export const runtime = "nodejs"

/** The charge's PaymentIntent for the customer to confirm on session (payment link, C6b). */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return chargeLinkResponse(async () => ({ ...(await chargeLinkPaymentIntent(token)), publishableKey: getStripePublishableKey() }))
}
