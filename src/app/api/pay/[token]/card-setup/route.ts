import { NextResponse } from "next/server"
import { z } from "zod"

import { clientIpFrom } from "@/features/card-security/server/card-security"
import { startChargeLinkCardUpdate } from "@/features/card-security/server/charge-link"
import { chargeLinkResponse } from "@/features/card-security/server/charge-link-response"
import { getStripePublishableKey } from "@/lib/integrations/stripe"

export const runtime = "nodejs"

const schema = z.object({ accepted: z.literal(true) })

/** Card-update link: logs the renewed consent, then a SetupIntent for the new card. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!schema.safeParse(await request.json().catch(() => null)).success) {
    return NextResponse.json({ success: false, code: "consent_not_accepted", message: "Tick the box to accept." }, { status: 400 })
  }

  return chargeLinkResponse(async () => ({
    ...(await startChargeLinkCardUpdate(token, { ip: clientIpFrom(request.headers), userAgent: request.headers.get("user-agent") })),
    publishableKey: getStripePublishableKey(),
  }))
}
