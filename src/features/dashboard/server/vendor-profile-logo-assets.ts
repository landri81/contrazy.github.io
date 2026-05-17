import { cloudinary } from "@/lib/integrations/cloudinary"
import {
  extractCloudinaryAssetDescriptor,
  isCloudinaryAssetUrl,
} from "@/lib/integrations/cloudinary-assets"
import {
  isVendorProfileLogoPublicIdOwnedByVendor,
} from "@/features/dashboard/lib/vendor-profile-logo-images"

type VendorProfileLogoInput = {
  businessLogoUrl?: string | null
  businessLogoPublicId?: string | null
  businessLogoFileName?: string | null
}

function inferLogoFileNameFromDescriptor(publicId: string, format: string) {
  const baseName = publicId.split("/").at(-1)?.trim()

  if (!baseName) {
    return null
  }

  return `${baseName}.${format}`
}

export function normalizeVendorProfileLogoImage(
  input: VendorProfileLogoInput,
  vendorId: string
) {
  const businessLogoUrl =
    typeof input.businessLogoUrl === "string" && input.businessLogoUrl.trim().length > 0
      ? input.businessLogoUrl.trim()
      : null
  const businessLogoPublicId =
    typeof input.businessLogoPublicId === "string" && input.businessLogoPublicId.trim().length > 0
      ? input.businessLogoPublicId.trim()
      : null
  const businessLogoFileName =
    typeof input.businessLogoFileName === "string" && input.businessLogoFileName.trim().length > 0
      ? input.businessLogoFileName.trim()
      : null

  if (!businessLogoUrl && !businessLogoPublicId && !businessLogoFileName) {
    return {
      businessLogoUrl: null,
      businessLogoPublicId: null,
      businessLogoFileName: null,
    }
  }

  if (!isCloudinaryAssetUrl(businessLogoUrl)) {
    throw new Error("Logo URL is invalid.")
  }

  const descriptor = extractCloudinaryAssetDescriptor(businessLogoUrl, businessLogoFileName)

  if (!descriptor || descriptor.resourceType !== "image") {
    throw new Error("Logo asset must be a valid image upload.")
  }

  const resolvedPublicId = businessLogoPublicId ?? descriptor.publicId
  const resolvedFileName = businessLogoFileName ?? inferLogoFileNameFromDescriptor(descriptor.publicId, descriptor.format)

  if (!resolvedPublicId) {
    throw new Error("Logo metadata is incomplete.")
  }

  if (!isVendorProfileLogoPublicIdOwnedByVendor(resolvedPublicId, vendorId)) {
    throw new Error("Logo upload is invalid for this vendor.")
  }

  return {
    businessLogoUrl,
    businessLogoPublicId: resolvedPublicId,
    businessLogoFileName: resolvedFileName,
  }
}

export function getVendorProfileLogoPublicId(
  assetUrl: string | null | undefined,
  fileName?: string | null
) {
  const descriptor = extractCloudinaryAssetDescriptor(assetUrl, fileName)

  if (!descriptor || descriptor.resourceType !== "image") {
    return null
  }

  return descriptor.publicId
}

export async function destroyVendorProfileLogoCloudinaryAsset(publicId: string | null | undefined) {
  if (!publicId) {
    return false
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: "upload",
    invalidate: true,
  })

  return true
}

export async function destroyVendorProfileLogoAssetIfOwnedByVendor(
  assetUrl: string | null | undefined,
  vendorId: string,
  fileName?: string | null
) {
  const publicId = getVendorProfileLogoPublicId(assetUrl, fileName)

  if (!publicId || !isVendorProfileLogoPublicIdOwnedByVendor(publicId, vendorId)) {
    return false
  }

  return destroyVendorProfileLogoCloudinaryAsset(publicId)
}
