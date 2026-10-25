import { NextResponse } from "next/server"
import { z } from "zod"

import { hasSecuredCard } from "@/features/card-security/card-security-state"
import { ConsentPartiesMissingError } from "@/features/card-security/consent-texts"
import { clientIpFrom, findCardConsent, recordCardConsent } from "@/features/card-security/server/card-security"
import { loadClientCardSecurityContext } from "@/features/card-security/server/client-card-security"
import { prisma } from "@/lib/db/prisma"

export const runtime = "nodejs"

const consentSchema = z.object({ accepted: z.literal(true) })

/**
 * Records the customer's consent to later charges on the saved card (Spec
 * v2.1 §6) before any card form is shown. The box must be ticked
 * (`accepted: true`); the exact text, version, IP and browser are stored
 * server-side. Calling it again once consent exists changes nothing.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const parsed = consentSchema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json({ success: false, code: "consent_not_accepted", message: "Tick the box to accept." }, { status: 400 })
    }

    const context = await loadClientCardSecurityContext(token)

    if ("error" in context) {
      return context.error
    }

    const { transaction } = context

    if (hasSecuredCard(transaction) || (await findCardConsent(prisma, transaction.id))) {
      return NextResponse.json({ success: true })
    }

    await recordCardConsent(prisma, {
      transaction: { id: transaction.id, externalRef: transaction.externalRef, locale: transaction.locale, vendor: transaction.vendor! },
      ip: clientIpFrom(request.headers),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ConsentPartiesMissingError) {
      return NextResponse.json({ success: false, code: "vendor_profile_incomplete", message: error.message }, { status: 422 })
    }

    console.error("Card consent error", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, message: "Could not record your consent. Please try again." }, { status: 500 })
  }
}
