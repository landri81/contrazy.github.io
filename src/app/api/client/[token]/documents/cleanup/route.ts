import { NextResponse } from "next/server"

import {
  destroyDocumentCloudinaryAsset,
  type ClientDocumentAssetCleanupInput,
} from "@/features/client-flow/server/client-document-assets"
import { isManagedClientDocumentPublicId } from "@/features/client-flow/lib/client-document-uploads"
import { getClientLinkAccessContext } from "@/features/transactions/server/transaction-links"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const linkContext = await getClientLinkAccessContext(token)

    if (linkContext.state === "missing") {
      return NextResponse.json({ success: false, message: "Invalid link" }, { status: 404 })
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
        const nextAsset: ClientDocumentAssetCleanupInput = {
          publicId: typeof assetRecord.publicId === "string" ? assetRecord.publicId : null,
          assetUrl: typeof assetRecord.assetUrl === "string" ? assetRecord.assetUrl : null,
          fileName: typeof assetRecord.fileName === "string" ? assetRecord.fileName : null,
        }

        if (!isManagedClientDocumentPublicId(nextAsset.publicId)) {
          return null
        }

        return nextAsset
      })
      .filter((asset): asset is ClientDocumentAssetCleanupInput => Boolean(asset))

    await Promise.allSettled(
      assets.map((asset) =>
        destroyDocumentCloudinaryAsset({
          publicId: asset.publicId,
          assetUrl: asset.assetUrl,
          fileName: asset.fileName,
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Client document cleanup failed", error)
    return NextResponse.json(
      { success: false, message: "Unable to clean up temporary files." },
      { status: 500 }
    )
  }
}
