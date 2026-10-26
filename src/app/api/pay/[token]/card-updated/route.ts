import { NextResponse } from "next/server"
import { z } from "zod"

import { finishChargeLinkCardUpdate } from "@/features/card-security/server/charge-link"
import { chargeLinkResponse } from "@/features/card-security/server/charge-link-response"

export const runtime = "nodejs"
export const maxDuration = 30

const schema = z.object({ setupIntentId: z.string().trim().min(1).max(255) })

/** The new card is saved: it replaces the old one and the charge is tried again at once. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const parsed = schema.safeParse(await request.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Setup intent ID is required" }, { status: 400 })
  }

  return chargeLinkResponse(() => finishChargeLinkCardUpdate(token, parsed.data.setupIntentId))
}
