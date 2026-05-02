import { NextResponse } from "next/server"

import { prisma } from "@/lib/db/prisma"
import { APP_METADATA } from "@/lib/config/app-metadata"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      ok: true,
      service: APP_METADATA.serviceName,
      database: "connected",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Health check failed", error)
    return NextResponse.json(
      {
        ok: false,
        service: APP_METADATA.serviceName,
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
