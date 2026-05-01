import { NextResponse } from "next/server"

import { cloudinary } from "@/lib/integrations/cloudinary"

export async function GET() {
  try {
    const result = await cloudinary.api.ping()

    return NextResponse.json({
      ok: true,
      service: "cloudinary",
      result,
    })
  } catch (error) {
    console.error("Cloudinary ping failed", error)
    return NextResponse.json(
      {
        ok: false,
        service: "cloudinary",
        message: "Cloudinary ping failed",
      },
      { status: 500 }
    )
  }
}
