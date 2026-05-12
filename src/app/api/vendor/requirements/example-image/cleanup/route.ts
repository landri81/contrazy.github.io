import { NextResponse } from "next/server"

import { destroyRequirementExampleCloudinaryAsset } from "@/features/dashboard/server/requirement-example-assets"
import {
  isVendorRequirementExamplePublicIdOwnedByVendor,
  type RequirementExampleCleanupAsset,
} from "@/features/dashboard/lib/vendor-requirement-example-images"
import { ensureVendorSubscriptionEligible, requireVendorProfileAccess } from "@/lib/auth/guards"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const { response } = await ensureVendorSubscriptionEligible(vendorProfile.id)

    if (response) {
      return response
    }

    const body = await request.json().catch(() => null)
    const rawAssets = Array.isArray(body?.assets) ? body.assets : null

    if (!rawAssets) {
      return NextResponse.json({ success: false, message: "Invalid cleanup payload." }, { status: 400 })
    }

    const assets = (rawAssets as unknown[])
      .map((asset: unknown) => {
        if (!asset || typeof asset !== "object") {
          return null
        }

        const assetRecord = asset as Record<string, unknown>
        const nextAsset: RequirementExampleCleanupAsset = {
          publicId: typeof assetRecord.publicId === "string" ? assetRecord.publicId : "",
          assetUrl: typeof assetRecord.assetUrl === "string" ? assetRecord.assetUrl : "",
          fileName: typeof assetRecord.fileName === "string" ? assetRecord.fileName : "",
        }

        if (!isVendorRequirementExamplePublicIdOwnedByVendor(nextAsset.publicId, vendorProfile.id)) {
          return null
        }

        return nextAsset
      })
      .filter((asset): asset is RequirementExampleCleanupAsset => Boolean(asset))

    await Promise.allSettled(
      assets.map((asset) =>
        destroyRequirementExampleCloudinaryAsset({
          publicId: asset.publicId,
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Vendor requirement example cleanup failed", error)
    return NextResponse.json(
      { success: false, message: "Unable to clean up temporary files." },
      { status: 500 }
    )
  }
}
