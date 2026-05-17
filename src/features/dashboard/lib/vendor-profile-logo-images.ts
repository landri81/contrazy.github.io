export const VENDOR_PROFILE_LOGO_UPLOAD_FOLDER = "conntrazy/vendor-logos"
export const MAX_VENDOR_PROFILE_LOGO_BYTES = 5 * 1024 * 1024

export type VendorProfileLogoAsset = {
  assetUrl: string
  publicId: string
  fileName: string
}

export type VendorProfileLogoCleanupAsset = VendorProfileLogoAsset

export function getVendorProfileLogoUploadFolder(vendorId: string) {
  return `${VENDOR_PROFILE_LOGO_UPLOAD_FOLDER}/${vendorId}`
}

export function isManagedVendorProfileLogoPublicId(publicId: string | null | undefined) {
  return typeof publicId === "string" && publicId.startsWith(`${VENDOR_PROFILE_LOGO_UPLOAD_FOLDER}/`)
}

export function isVendorProfileLogoPublicIdOwnedByVendor(
  publicId: string | null | undefined,
  vendorId: string
) {
  return typeof publicId === "string" && publicId.startsWith(`${getVendorProfileLogoUploadFolder(vendorId)}/`)
}

export function toVendorProfileLogoCleanupAsset(
  asset: Pick<VendorProfileLogoAsset, "publicId" | "assetUrl" | "fileName">
) {
  return {
    publicId: asset.publicId,
    assetUrl: asset.assetUrl,
    fileName: asset.fileName,
  }
}
