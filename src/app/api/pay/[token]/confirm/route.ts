import { confirmChargeLinkPayment } from "@/features/card-security/server/charge-link"
import { chargeLinkResponse } from "@/features/card-security/server/charge-link-response"

export const runtime = "nodejs"

/** After the customer confirmed the payment on session: settled from Stripe's answer. */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return chargeLinkResponse(() => confirmChargeLinkPayment(token))
}
