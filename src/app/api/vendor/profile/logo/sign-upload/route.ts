import { NextResponse } from "next/server"

import { getVendorProfileLogoUploadFolder } from "@/features/dashboard/lib/vendor-profile-logo-images"
import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { env } from "@/lib/env"
import { cloudinary } from "@/lib/integrations/cloudinary"

export const runtime = "nodejs"

export async function POST() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const folder = getVendorProfileLogoUploadFolder(vendorProfile.id)
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
    console.error("Vendor profile logo signature error", error)
    return NextResponse.json(
      { ok: false, message: "Could not sign logo upload payload" },
      { status: 500 }
    )
  }
}
