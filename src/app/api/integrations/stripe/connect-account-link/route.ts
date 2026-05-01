import { NextResponse } from "next/server"
import { z } from "zod"

import { stripe } from "@/lib/integrations/stripe"

const payloadSchema = z.object({
  accountId: z.string().min(1),
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsedBody = payloadSchema.safeParse(body)

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          ok: false,
          message: parsedBody.error.issues[0]?.message ?? "Invalid request payload",
        },
        { status: 400 }
      )
    }

    const { accountId, refreshUrl, returnUrl } = parsedBody.data

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    })

    return NextResponse.json({
      ok: true,
      url: link.url,
      expiresAt: link.expires_at,
    })
  } catch (error) {
    console.error("Stripe connect link error", error)
    return NextResponse.json(
      {
        ok: false,
        message: "Failed to create Stripe Connect onboarding link",
      },
      { status: 500 }
    )
  }
}
