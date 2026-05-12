import {
  MAX_VENDOR_REQUIREMENT_EXAMPLE_IMAGE_BYTES,
  type RequirementExampleAsset,
  type RequirementExampleCleanupAsset,
} from "@/features/dashboard/lib/vendor-requirement-example-images"

export class VendorRequirementExampleUploadError extends Error {
  code:
    | "INVALID_TYPE"
    | "FILE_TOO_LARGE"
    | "SIGNING_FAILED"
    | "UPLOAD_FAILED"

  constructor(
    code: VendorRequirementExampleUploadError["code"],
    message: string
  ) {
    super(message)
    this.code = code
  }
}

export async function uploadVendorRequirementExampleImage(file: File): Promise<RequirementExampleAsset> {
  if (!file.type.startsWith("image/")) {
    throw new VendorRequirementExampleUploadError("INVALID_TYPE", "Only image files are allowed.")
  }

  if (file.size > MAX_VENDOR_REQUIREMENT_EXAMPLE_IMAGE_BYTES) {
    throw new VendorRequirementExampleUploadError("FILE_TOO_LARGE", "The image is too large.")
  }

  const signResponse = await fetch("/api/vendor/requirements/example-image/sign-upload", {
    method: "POST",
  })

  if (!signResponse.ok) {
    throw new VendorRequirementExampleUploadError("SIGNING_FAILED", "Upload signing failed.")
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
    throw new VendorRequirementExampleUploadError(
      "UPLOAD_FAILED",
      uploadPayload?.error?.message ?? "The example image upload failed."
    )
  }

  return {
    assetUrl: uploadPayload.secure_url,
    publicId: uploadPayload.public_id,
    fileName: file.name,
  }
}

export async function cleanupVendorRequirementExampleImages(
  assets: RequirementExampleCleanupAsset[],
  options?: { keepalive?: boolean }
) {
  if (assets.length === 0) {
    return
  }

  try {
    await fetch("/api/vendor/requirements/example-image/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
      keepalive: options?.keepalive,
    })
  } catch (error) {
    console.warn("Vendor requirement example cleanup failed", error)
  }
}
