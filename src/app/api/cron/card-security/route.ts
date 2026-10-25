import { NextResponse } from "next/server"

import { detachExpiredCards } from "@/features/card-security/server/card-window"
import { isCronAuthorized } from "@/lib/auth/cron"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Daily: detaches saved cards whose 90-day charge window has ended, unless a
 * dispute is still open (Spec v2.1 §13). Protected by `CRON_SECRET`; Vercel
 * Cron calls it with GET, POST runs the same job for other schedulers.
 */
async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = await detachExpiredCards(prisma, stripeGateway)
  return NextResponse.json({ ok: true, ...summary })
}

export const GET = handle
export const POST = handle
