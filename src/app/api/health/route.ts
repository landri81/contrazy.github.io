import { NextResponse } from "next/server"

import { prisma } from "@/lib/db/prisma"

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      ok: true,
      service: "conntrazy-week1-foundation",
      database: "connected",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Health check failed", error)
    return NextResponse.json(
      {
        ok: false,
        service: "conntrazy-week1-foundation",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
