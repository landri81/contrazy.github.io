import { NextResponse } from "next/server"

import { runPartnerWebhookWorker } from "@/features/partner-webhooks/server/delivery-worker"
import { isCronAuthorized } from "@/lib/auth/cron"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Partner webhook delivery worker. Sends due outbox deliveries (10 s timeout,
 * backoff 1 m → 24 h, then DEAD). Protected by `CRON_SECRET`. Vercel Cron
 * calls it with GET every minute; POST runs the same job for other schedulers.
 */
async function handle(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = await runPartnerWebhookWorker()
  return NextResponse.json({ ok: true, ...summary })
}

export const GET = handle
export const POST = handle
