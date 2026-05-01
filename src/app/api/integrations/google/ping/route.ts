import { NextResponse } from "next/server"

import { env } from "@/lib/env"

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "google-oauth",
    clientConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    redirectUri: `${env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/callback/google`,
  })
}
