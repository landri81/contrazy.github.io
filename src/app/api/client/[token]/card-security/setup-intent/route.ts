import { NextResponse } from "next/server"

import { loadClientCardSecurityContext } from "@/features/card-security/server/client-card-security"
import { startClientCardSetup } from "@/features/client-flow/server/steps/card-setup"
import { normalizeLocale, withLocalePath } from "@/lib/i18n/locale-utils"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * "Card as security only" (Spec v2.1 §4): a SetupIntent with usage
 * off_session on the vendor's connected account, for the customer's Stripe
 * customer. Only after consent (409 consent_required otherwise).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const context = await loadClientCardSecurityContext(token)

    if ("error" in context) {
      return context.error
    }

    const result = await startClientCardSetup(context)

    if (result.body.next) {
      return NextResponse.json({ success: true, redirect: withLocalePath(normalizeLocale(context.transaction.locale), `/t/${token}/${result.body.next}`) })
    }

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Card setup intent error", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Failed to initialize the card form" }, { status: 500 })
  }
}
