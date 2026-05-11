import type { DocumentAsset, RequirementType, TransactionRequirement } from "@prisma/client"

import { cloudinary } from "@/lib/integrations/cloudinary"
import { extractCloudinaryAssetDescriptor, isPdfAssetUrl } from "@/lib/integrations/cloudinary-assets"

type DocumentAssetCleanupInput = Pick<DocumentAsset, "assetUrl" | "fileName" | "publicId">

const CLIENT_DOCUMENT_UPLOAD_PREFIX = "conntrazy/client-documents/"

export function isManagedClientDocumentUpload(publicId: string | null | undefined) {
  return typeof publicId === "string" && publicId.startsWith(CLIENT_DOCUMENT_UPLOAD_PREFIX)
}

export async function destroyDocumentAssetUpload(document: DocumentAssetCleanupInput) {
  if (!document.publicId && !document.assetUrl) {
    return
  }

  const descriptor = extractCloudinaryAssetDescriptor(document.assetUrl, document.fileName)
  const publicId = document.publicId ?? descriptor?.publicId
  const resourceType = descriptor?.resourceType ?? (isPdfAssetUrl(document.assetUrl, document.fileName) ? "raw" : "image")

  if (!publicId) {
    return
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: "upload",
    invalidate: true,
  })
}

export function isRequirementSatisfied(
  requirement: Pick<TransactionRequirement, "id" | "type">,
  documents: Array<Pick<DocumentAsset, "requirementId" | "textValue" | "assetUrl">>
) {
  return documents.some(
    (document) =>
      document.requirementId === requirement.id &&
      (requirement.type === "TEXT"
        ? Boolean(document.textValue?.trim())
        : Boolean(document.assetUrl))
  )
}

export function resolveRequirementType(
  inputType: string | undefined,
  requirementType: RequirementType | undefined
) {
  return (inputType || requirementType || "DOCUMENT") as RequirementType
}
