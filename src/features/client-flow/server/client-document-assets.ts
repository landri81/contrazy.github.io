import { cloudinary } from "@/lib/integrations/cloudinary"
import { extractCloudinaryAssetDescriptor, isPdfAssetUrl } from "@/lib/integrations/cloudinary-assets"

export type ClientDocumentAssetCleanupInput = {
  publicId?: string | null
  assetUrl?: string | null
  fileName?: string | null
}

export async function destroyDocumentCloudinaryAsset(input: ClientDocumentAssetCleanupInput) {
  const descriptor = extractCloudinaryAssetDescriptor(input.assetUrl, input.fileName)
  const publicId = input.publicId ?? descriptor?.publicId
  const resourceType =
    descriptor?.resourceType ?? (isPdfAssetUrl(input.assetUrl, input.fileName) ? "raw" : "image")

  if (!publicId) {
    return false
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "upload",
    invalidate: true,
  })

  return true
}
