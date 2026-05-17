import { NextResponse } from "next/server"
import { z } from "zod"

import {
  type ContractTemplateInlineImageAsset,
  isVendorContractInlineImagePublicIdOwnedByVendor,
} from "@/features/contracts/contract-template-inline-assets"
import { deleteContractTemplateInlineImageIfUnreferenced } from "@/features/contracts/server/contract-template-assets"
import {
  ensureVendorPreparationAllowed,
  ensureVendorSubscriptionEligible,
  requireVendorProfileAccess,
} from "@/lib/auth/guards"

const cleanupSchema = z.object({
  assets: z
    .array(
      z.object({
        publicId: z.string().min(1),
        assetUrl: z.string().min(1),
        fileName: z.string().min(1),
      })
    )
    .default([]),
})

export const runtime = "nodejs"

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null)
    const parsed = cleanupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "Invalid cleanup payload." }, { status: 400 })
    }

    const ownedAssets = parsed.data.assets.filter((asset) =>
      isVendorContractInlineImagePublicIdOwnedByVendor(asset.publicId, vendorProfile.id)
    )

    await Promise.allSettled(
      ownedAssets.map((asset: ContractTemplateInlineImageAsset) =>
        deleteContractTemplateInlineImageIfUnreferenced(asset.publicId)
      )
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Contract template image cleanup failed", error)
    return NextResponse.json(
      { ok: false, message: "Unable to clean up contract images." },
      { status: 500 }
    )
  }
}
