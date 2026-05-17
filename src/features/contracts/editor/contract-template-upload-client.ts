import {
  MAX_VENDOR_CONTRACT_IMPORT_BYTES,
  MAX_VENDOR_CONTRACT_INLINE_IMAGE_BYTES,
  type ContractTemplateInlineImageAsset,
} from "@/features/contracts/contract-template-inline-assets"

export class ContractTemplateUploadError extends Error {
  code:
    | "INVALID_IMAGE_TYPE"
    | "IMAGE_TOO_LARGE"
    | "INVALID_IMPORT_TYPE"
    | "IMPORT_TOO_LARGE"
    | "SIGNING_FAILED"
    | "UPLOAD_FAILED"
    | "IMPORT_FAILED"

  constructor(code: ContractTemplateUploadError["code"], message: string) {
    super(message)
    this.code = code
  }
}

export async function uploadContractTemplateInlineImage(
  file: File
): Promise<ContractTemplateInlineImageAsset> {
  if (!file.type.startsWith("image/")) {
    throw new ContractTemplateUploadError("INVALID_IMAGE_TYPE", "Only image files are allowed.")
  }

  if (file.size > MAX_VENDOR_CONTRACT_INLINE_IMAGE_BYTES) {
    throw new ContractTemplateUploadError("IMAGE_TOO_LARGE", "The image is too large.")
  }

  const signResponse = await fetch("/api/vendor/contracts/assets/sign-upload", {
    method: "POST",
  })

  if (!signResponse.ok) {
    throw new ContractTemplateUploadError("SIGNING_FAILED", "Upload signing failed.")
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
    throw new ContractTemplateUploadError(
      "UPLOAD_FAILED",
      uploadPayload?.error?.message ?? "The contract image upload failed."
    )
  }

  return {
    assetUrl: uploadPayload.secure_url,
    publicId: uploadPayload.public_id,
    fileName: file.name,
  }
}

export async function cleanupContractTemplateInlineImages(
  assets: ContractTemplateInlineImageAsset[],
  options?: { keepalive?: boolean }
) {
  if (assets.length === 0) {
    return
  }

  try {
    await fetch("/api/vendor/contracts/assets/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
      keepalive: options?.keepalive,
    })
  } catch (error) {
    console.warn("Contract template image cleanup failed", error)
  }
}

function isAcceptedImportFile(file: File) {
  const lowerName = file.name.toLowerCase()
  return (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx") ||
    file.type === "application/pdf" ||
    lowerName.endsWith(".pdf")
  )
}

export async function importContractTemplateDocument(file: File) {
  if (!isAcceptedImportFile(file)) {
    throw new ContractTemplateUploadError(
      "INVALID_IMPORT_TYPE",
      "Only DOCX and PDF files can be imported."
    )
  }

  if (file.size > MAX_VENDOR_CONTRACT_IMPORT_BYTES) {
    throw new ContractTemplateUploadError("IMPORT_TOO_LARGE", "The import file is too large.")
  }

  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/vendor/contracts/import", {
    method: "POST",
    body: formData,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.html) {
    throw new ContractTemplateUploadError(
      "IMPORT_FAILED",
      payload?.message ?? "Unable to import this document."
    )
  }

  return {
    html: payload.html as string,
  }
}
