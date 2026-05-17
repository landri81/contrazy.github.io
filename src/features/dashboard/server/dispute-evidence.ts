import { cloudinary } from "@/lib/integrations/cloudinary"
import {
  extractCloudinaryAssetDescriptor,
  isPdfAssetUrl,
  type CloudinaryResourceType,
} from "@/lib/integrations/cloudinary-assets"

export type StoredDisputeEvidenceAsset = {
  assetUrl: string
  publicId: string
  fileName: string
}

export type VendorDisputeEvidenceAsset = StoredDisputeEvidenceAsset & {
  kind: "image" | "pdf"
  viewUrl: string
  downloadUrl: string
}

type CloudinaryAssetDescriptor = {
  publicId: string
  resourceType: CloudinaryResourceType
  format: string
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function inferFileNameFromUrl(url: string | null | undefined) {
  if (!url) {
    return null
  }

  try {
    const parsed = new URL(url)
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop()

    return lastSegment ? decodeURIComponent(lastSegment) : null
  } catch {
    return null
  }
}

function inferFileExtension(
  fileName: string | null | undefined,
  assetUrl: string | null | undefined,
  fallback: string
) {
  const candidate = fileName ?? inferFileNameFromUrl(assetUrl) ?? ""
  const dotIndex = candidate.lastIndexOf(".")

  if (dotIndex >= 0 && dotIndex < candidate.length - 1) {
    return candidate.slice(dotIndex + 1).split("?")[0].toLowerCase()
  }

  return fallback
}

function resolveAssetDescriptor(asset: StoredDisputeEvidenceAsset): CloudinaryAssetDescriptor | null {
  const descriptor = extractCloudinaryAssetDescriptor(asset.assetUrl, asset.fileName)

  if (descriptor) {
    return descriptor
  }

  if (!asset.publicId) {
    return null
  }

  const pdf = isPdfAssetUrl(asset.assetUrl, asset.fileName)

  return {
    publicId: asset.publicId,
    resourceType: pdf ? "raw" : "image",
    format: inferFileExtension(asset.fileName, asset.assetUrl, pdf ? "pdf" : "jpg"),
  }
}

function buildCloudinaryAccessPath(
  descriptor: CloudinaryAssetDescriptor | null,
  fileName: string | null | undefined,
  disposition: "attachment" | "inline"
) {
  if (!descriptor) {
    return null
  }

  const params = new URLSearchParams({
    publicId: descriptor.publicId,
    resourceType: descriptor.resourceType,
    format: descriptor.format,
    disposition,
  })

  if (fileName) {
    params.set("fileName", fileName)
  }

  return `/api/integrations/cloudinary/download?${params.toString()}`
}

export function parseDisputeEvidenceAssets(raw: unknown): StoredDisputeEvidenceAsset[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return []
    }

    const assetUrl = asNonEmptyString((item as { assetUrl?: unknown }).assetUrl)
    if (!assetUrl) {
      return []
    }

    const publicId =
      asNonEmptyString((item as { publicId?: unknown }).publicId) ??
      extractCloudinaryAssetDescriptor(assetUrl)?.publicId ??
      ""
    const fileName =
      asNonEmptyString((item as { fileName?: unknown }).fileName) ??
      inferFileNameFromUrl(assetUrl) ??
      publicId.split("/").pop() ??
      "evidence-file"

    return [{ assetUrl, publicId, fileName }]
  })
}

export function buildVendorDisputeEvidenceAsset(asset: StoredDisputeEvidenceAsset): VendorDisputeEvidenceAsset {
  const descriptor = resolveAssetDescriptor(asset)
  const kind = isPdfAssetUrl(asset.assetUrl, asset.fileName) ? "pdf" : "image"

  return {
    ...asset,
    kind,
    viewUrl:
      kind === "pdf"
        ? buildCloudinaryAccessPath(descriptor, asset.fileName, "inline") ?? asset.assetUrl
        : asset.assetUrl,
    downloadUrl: buildCloudinaryAccessPath(descriptor, asset.fileName, "attachment") ?? asset.assetUrl,
  }
}

export function createDisputeEvidenceFetchUrl(asset: StoredDisputeEvidenceAsset) {
  const descriptor = resolveAssetDescriptor(asset)

  if (!descriptor) {
    return asset.assetUrl
  }

  return cloudinary.utils.private_download_url(descriptor.publicId, descriptor.format, {
    resource_type: descriptor.resourceType,
    type: "upload",
    attachment: false,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
  })
}
