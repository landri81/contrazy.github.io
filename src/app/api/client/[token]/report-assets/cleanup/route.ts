import { NextResponse } from "next/server"

import { destroyDocumentCloudinaryAsset } from "@/features/client-flow/server/client-document-assets"
import { isManagedReportAssetPublicId } from "@/features/client-flow/lib/client-document-uploads"
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
        if (!asset || typeof asset !== "object") return null
        const a = asset as Record<string, unknown>
        const publicId = typeof a.publicId === "string" ? a.publicId : null
        const assetUrl = typeof a.assetUrl === "string" ? a.assetUrl : null
        const fileName = typeof a.fileName === "string" ? a.fileName : null

        if (!isManagedReportAssetPublicId(publicId)) return null

        return { publicId, assetUrl, fileName }
      })
      .filter((a): a is { publicId: string; assetUrl: string | null; fileName: string | null } =>
        Boolean(a)
      )

    await Promise.allSettled(
      assets.map((a) =>
        destroyDocumentCloudinaryAsset({ publicId: a.publicId, assetUrl: a.assetUrl, fileName: a.fileName })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Report asset cleanup failed", error)
    return NextResponse.json({ success: false, message: "Unable to clean up temporary files." }, { status: 500 })
  }
}
