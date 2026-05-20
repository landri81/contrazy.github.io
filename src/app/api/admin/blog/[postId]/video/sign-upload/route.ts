import { NextResponse } from "next/server"

import { getAuthSession } from "@/lib/auth/session"
import { env } from "@/lib/env"
import { cloudinary } from "@/lib/integrations/cloudinary"

export const runtime = "nodejs"

export async function POST(_request: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.email || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
    }

    const folder = "contrazy/blog-videos"
    const timestamp = Math.floor(Date.now() / 1000)

    // resource_type is part of the upload URL path, not a signed param
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
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
    console.error("Blog video sign-upload error:", error)
    return NextResponse.json({ ok: false, message: "Could not sign upload" }, { status: 500 })
  }
}
