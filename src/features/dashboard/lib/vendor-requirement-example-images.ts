export const VENDOR_REQUIREMENT_EXAMPLE_UPLOAD_FOLDER = "conntrazy/vendor-requirement-examples"
export const MAX_VENDOR_REQUIREMENT_EXAMPLE_IMAGE_BYTES = 10 * 1024 * 1024

export type RequirementExampleAsset = {
  assetUrl: string
  publicId: string
  fileName: string
}

export type RequirementExampleDraftSource = "local" | "saved" | "template"

export type RequirementExampleDraft = RequirementExampleAsset & {
  source: RequirementExampleDraftSource
}

export type RequirementExampleCleanupAsset = RequirementExampleAsset

export function getVendorRequirementExampleUploadFolder(vendorId: string) {
  return `${VENDOR_REQUIREMENT_EXAMPLE_UPLOAD_FOLDER}/${vendorId}`
}

export function isManagedVendorRequirementExamplePublicId(publicId: string | null | undefined) {
  return typeof publicId === "string" && publicId.startsWith(`${VENDOR_REQUIREMENT_EXAMPLE_UPLOAD_FOLDER}/`)
}

export function isVendorRequirementExamplePublicIdOwnedByVendor(
  publicId: string | null | undefined,
  vendorId: string
) {
  return typeof publicId === "string" && publicId.startsWith(`${getVendorRequirementExampleUploadFolder(vendorId)}/`)
}

export function toRequirementExampleCleanupAsset(
  asset: Pick<RequirementExampleAsset, "publicId" | "assetUrl" | "fileName">
) {
  return {
    publicId: asset.publicId,
    assetUrl: asset.assetUrl,
    fileName: asset.fileName,
  }
}
