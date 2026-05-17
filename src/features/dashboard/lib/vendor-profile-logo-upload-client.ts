import {
  MAX_VENDOR_PROFILE_LOGO_BYTES,
  type VendorProfileLogoAsset,
  type VendorProfileLogoCleanupAsset,
} from "@/features/dashboard/lib/vendor-profile-logo-images"

export class VendorProfileLogoUploadError extends Error {
  code:
    | "INVALID_TYPE"
    | "FILE_TOO_LARGE"
    | "SIGNING_FAILED"
    | "UPLOAD_FAILED"

  constructor(
    code: VendorProfileLogoUploadError["code"],
    message: string
  ) {
    super(message)
    this.code = code
  }
}

export async function uploadVendorProfileLogo(file: File): Promise<VendorProfileLogoAsset> {
  if (!file.type.startsWith("image/")) {
    throw new VendorProfileLogoUploadError("INVALID_TYPE", "Only image files are allowed.")
  }

  if (file.size > MAX_VENDOR_PROFILE_LOGO_BYTES) {
    throw new VendorProfileLogoUploadError("FILE_TOO_LARGE", "The logo image is too large.")
  }

  const signResponse = await fetch("/api/vendor/profile/logo/sign-upload", {
    method: "POST",
  })

  if (!signResponse.ok) {
    throw new VendorProfileLogoUploadError("SIGNING_FAILED", "Upload signing failed.")
  }

  const { apiKey, cloudName, folder, signature, timestamp } = await signResponse.json()

  const formData = new FormData()
  formData.append("file", file)
  formData.append("api_key", apiKey)
  formData.append("timestamp", timestamp.toString())
  formData.append("signature", signature)
  formData.append("folder", folder)

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  })
  const uploadPayload = await uploadResponse.json().catch(() => null)

  if (!uploadResponse.ok || !uploadPayload?.secure_url || !uploadPayload?.public_id) {
    throw new VendorProfileLogoUploadError(
      "UPLOAD_FAILED",
      uploadPayload?.error?.message ?? "The logo upload failed."
    )
  }

  return {
    assetUrl: uploadPayload.secure_url,
    publicId: uploadPayload.public_id,
    fileName: file.name,
  }
}

export async function cleanupVendorProfileLogos(
  assets: VendorProfileLogoCleanupAsset[],
  options?: { keepalive?: boolean }
) {
  if (assets.length === 0) {
    return
  }

  try {
    await fetch("/api/vendor/profile/logo/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
      keepalive: options?.keepalive,
    })
  } catch (error) {
    console.warn("Vendor profile logo cleanup failed", error)
  }
}
