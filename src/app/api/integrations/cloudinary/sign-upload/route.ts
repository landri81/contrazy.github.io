import { NextResponse } from "next/server"

import { env } from "@/lib/env"
import { cloudinary } from "@/lib/integrations/cloudinary"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const folder = typeof body.folder === "string" && body.folder.trim().length > 0 ? body.folder : "conntrazy"
    const timestamp = Math.floor(Date.now() / 1000)

    const signature = cloudinary.utils.api_sign_request(
      {
        folder,
        timestamp,
      },
      env.CLOUDINARY_API_SECRET
    )

    return NextResponse.json({
      ok: true,
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      folder,
      timestamp,
      signature,
    })
  } catch (error) {
    console.error("Cloudinary signature error", error)
    return NextResponse.json(
      { ok: false, message: "Could not sign upload payload" },
      { status: 500 }
    )
  }
}
