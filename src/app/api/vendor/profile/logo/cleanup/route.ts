import { NextResponse } from "next/server"
import { z } from "zod"

import { isVendorProfileLogoPublicIdOwnedByVendor } from "@/features/dashboard/lib/vendor-profile-logo-images"
import { destroyVendorProfileLogoCloudinaryAsset } from "@/features/dashboard/server/vendor-profile-logo-assets"
import { requireVendorProfileAccess } from "@/lib/auth/guards"

const cleanupSchema = z.object({
  assets: z.array(
    z.object({
      publicId: z.string().min(1),
      assetUrl: z.string().min(1),
      fileName: z.string().min(1),
    })
  ).default([]),
})

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { vendorProfile } = await requireVendorProfileAccess()
    const body = await request.json().catch(() => null)
    const parsed = cleanupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid cleanup payload" }, { status: 400 })
    }

    const ownedAssets = parsed.data.assets.filter((asset) =>
      isVendorProfileLogoPublicIdOwnedByVendor(asset.publicId, vendorProfile.id)
    )

    await Promise.allSettled(
      ownedAssets.map((asset) => destroyVendorProfileLogoCloudinaryAsset(asset.publicId))
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Vendor profile logo cleanup failed", error)
    return NextResponse.json({ ok: false, message: "Could not clean up logo upload" }, { status: 500 })
  }
}
