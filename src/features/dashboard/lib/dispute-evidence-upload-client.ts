import { isPdfFile } from "@/lib/integrations/cloudinary-assets"

export const MAX_DISPUTE_EVIDENCE_BYTES = 10 * 1024 * 1024 // 10 MB per file
export const MAX_DISPUTE_EVIDENCE_FILES = 10
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]

export type DisputeEvidenceAsset = {
  assetUrl: string
  publicId: string
  fileName: string
}

export class DisputeEvidenceUploadError extends Error {
  code: "INVALID_TYPE" | "FILE_TOO_LARGE" | "TOO_MANY_FILES" | "SIGNING_FAILED" | "UPLOAD_FAILED"

  constructor(code: DisputeEvidenceUploadError["code"], message: string) {
    super(message)
    this.code = code
  }
}

export function validateDisputeEvidenceFile(file: File): DisputeEvidenceUploadError | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return new DisputeEvidenceUploadError("INVALID_TYPE", `"${file.name}" is not allowed. Use JPG, PNG, WebP, GIF, or PDF.`)
  }
  if (file.size > MAX_DISPUTE_EVIDENCE_BYTES) {
    return new DisputeEvidenceUploadError("FILE_TOO_LARGE", `"${file.name}" exceeds 10 MB.`)
  }
  return null
}

export async function uploadDisputeEvidence(
  file: File,
  transactionId: string
): Promise<DisputeEvidenceAsset> {
  const folder = `conntrazy/disputes/${transactionId}`

  const sigRes = await fetch("/api/integrations/cloudinary/sign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  })

  if (!sigRes.ok) {
    throw new DisputeEvidenceUploadError("SIGNING_FAILED", "Upload signing failed. Please try again.")
  }

  const { timestamp, signature, apiKey, cloudName } = await sigRes.json()

  const formData = new FormData()
  formData.append("file", file)
  formData.append("api_key", apiKey)
  formData.append("timestamp", timestamp.toString())
  formData.append("signature", signature)
  formData.append("folder", folder)

  const uploadEndpoint = isPdfFile(file) ? "raw" : "auto"
  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${uploadEndpoint}/upload`,
    { method: "POST", body: formData }
  )

  const payload = await uploadRes.json().catch(() => null)

  if (!uploadRes.ok || !payload?.secure_url || !payload?.public_id) {
    throw new DisputeEvidenceUploadError(
      "UPLOAD_FAILED",
      payload?.error?.message ?? `Failed to upload "${file.name}".`
    )
  }

  return {
    assetUrl: payload.secure_url,
    publicId: payload.public_id,
    fileName: file.name,
  }
}
