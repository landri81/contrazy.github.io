import { NextResponse } from "next/server"

import { getVendorRequirementExampleUploadFolder } from "@/features/dashboard/lib/vendor-requirement-example-images"
import { requireVendorProfileAccess, ensureVendorSubscriptionEligible } from "@/lib/auth/guards"
import { env } from "@/lib/env"
import { cloudinary } from "@/lib/integrations/cloudinary"

export const runtime = "nodejs"

export async function POST() {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const folder = getVendorRequirementExampleUploadFolder(vendorProfile.id)
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
    console.error("Vendor requirement example signature error", error)
    return NextResponse.json(
      { ok: false, message: "Could not sign upload payload" },
      { status: 500 }
    )
  }
}
