import { NextRequest, NextResponse } from "next/server"

import { cloudinary } from "@/lib/integrations/cloudinary"

const ALLOWED_RESOURCE_TYPES = new Set(["image", "raw", "video"])

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publicId = searchParams.get("publicId")
    const resourceType = searchParams.get("resourceType")
    const format = searchParams.get("format")

    if (!publicId || !resourceType || !format || !ALLOWED_RESOURCE_TYPES.has(resourceType)) {
      return NextResponse.json({ ok: false, message: "Invalid download request." }, { status: 400 })
    }

    const downloadUrl = cloudinary.utils.private_download_url(publicId, format, {
      resource_type: resourceType as "image" | "raw" | "video",
      type: "upload",
      attachment: true,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
    })

    return NextResponse.redirect(downloadUrl, { status: 302 })
  } catch (error) {
    console.error("Cloudinary download error", error)
    return NextResponse.json({ ok: false, message: "Unable to prepare this file for download." }, { status: 500 })
  }
}
