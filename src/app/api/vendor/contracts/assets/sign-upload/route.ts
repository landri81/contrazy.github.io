import { NextResponse } from "next/server"

import { getVendorContractInlineImageUploadFolder } from "@/features/contracts/contract-template-inline-assets"
import {
  ensureVendorPreparationAllowed,
  ensureVendorSubscriptionEligible,
  requireVendorProfileAccess,
} from "@/lib/auth/guards"
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

    const blockedResponse = ensureVendorPreparationAllowed(vendorProfile)

    if (blockedResponse) {
      return blockedResponse
    }

    const folder = getVendorContractInlineImageUploadFolder(vendorProfile.id)
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
    console.error("Contract template image signing failed", error)
    return NextResponse.json(
      { ok: false, message: "Could not sign contract image upload." },
      { status: 500 }
    )
  }
}
