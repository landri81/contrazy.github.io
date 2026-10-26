import { NextResponse } from "next/server"

import { retryDuePostCharges } from "@/features/card-security/server/post-charges"
import { isCronAuthorized } from "@/lib/auth/cron"
import { prisma } from "@/lib/db/prisma"
import { stripeGateway } from "@/lib/integrations/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Hourly: off-session retries of declined post-rental charges that are due (Spec v2.1 §9). `CRON_SECRET` only. */
async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = await retryDuePostCharges(prisma, stripeGateway)
  return NextResponse.json({ ok: true, ...summary })
}

export const GET = handle
export const POST = handle
