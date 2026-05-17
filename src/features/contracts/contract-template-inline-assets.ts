import { extractCloudinaryAssetDescriptor } from "@/lib/integrations/cloudinary-assets"

export const VENDOR_CONTRACT_INLINE_IMAGE_UPLOAD_FOLDER = "conntrazy/vendor-contract-images"
export const MAX_VENDOR_CONTRACT_INLINE_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_VENDOR_CONTRACT_IMPORT_BYTES = 20 * 1024 * 1024

export type ContractTemplateInlineImageAsset = {
  assetUrl: string
  publicId: string
  fileName: string
}

const imageTagPattern = /<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi

function inferFileName(publicId: string, url: string) {
  try {
    const parsed = new URL(url)
    const lastSegment = parsed.pathname.split("/").filter(Boolean).at(-1)
    if (lastSegment) {
      return decodeURIComponent(lastSegment)
    }
  } catch {
    // Ignore URL parsing failures and fall through.
  }

  return publicId.split("/").at(-1) ?? "contract-image"
}

export function getVendorContractInlineImageUploadFolder(vendorId: string) {
  return `${VENDOR_CONTRACT_INLINE_IMAGE_UPLOAD_FOLDER}/${vendorId}`
}

export function isManagedVendorContractInlineImagePublicId(publicId: string | null | undefined) {
  return (
    typeof publicId === "string" &&
    publicId.startsWith(`${VENDOR_CONTRACT_INLINE_IMAGE_UPLOAD_FOLDER}/`)
  )
}

export function isVendorContractInlineImagePublicIdOwnedByVendor(
  publicId: string | null | undefined,
  vendorId: string
) {
  return (
    typeof publicId === "string" &&
    publicId.startsWith(`${getVendorContractInlineImageUploadFolder(vendorId)}/`)
  )
}

export function extractContractImageSources(content: string) {
  const sources: string[] = []

  for (const match of content.matchAll(imageTagPattern)) {
    const src = match[2]?.trim()
    if (src) {
      sources.push(src)
    }
  }

  return sources
}

export function extractManagedContractTemplateInlineImageAssets(content: string) {
  const byPublicId = new Map<string, ContractTemplateInlineImageAsset>()

  for (const src of extractContractImageSources(content)) {
    const descriptor = extractCloudinaryAssetDescriptor(src)

    if (!descriptor || descriptor.resourceType !== "image") {
      continue
    }

    if (!isManagedVendorContractInlineImagePublicId(descriptor.publicId)) {
      continue
    }

    if (!byPublicId.has(descriptor.publicId)) {
      byPublicId.set(descriptor.publicId, {
        assetUrl: src,
        publicId: descriptor.publicId,
        fileName: inferFileName(descriptor.publicId, src),
      })
    }
  }

  return Array.from(byPublicId.values())
}
