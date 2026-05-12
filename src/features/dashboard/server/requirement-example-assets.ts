import { RequirementType } from "@prisma/client"

import { cloudinary } from "@/lib/integrations/cloudinary"
import {
  extractCloudinaryAssetDescriptor,
  isCloudinaryAssetUrl,
} from "@/lib/integrations/cloudinary-assets"
import { prisma } from "@/lib/db/prisma"
import {
  isVendorRequirementExamplePublicIdOwnedByVendor,
  type RequirementExampleAsset,
} from "@/features/dashboard/lib/vendor-requirement-example-images"

type RequirementExampleImageInput = {
  exampleImageUrl?: string | null
  exampleImagePublicId?: string | null
  exampleImageFileName?: string | null
}

export async function destroyRequirementExampleCloudinaryAsset(
  asset: Pick<RequirementExampleAsset, "publicId"> | { publicId?: string | null }
) {
  if (!asset.publicId) {
    return false
  }

  await cloudinary.uploader.destroy(asset.publicId, {
    resource_type: "image",
    type: "upload",
    invalidate: true,
  })

  return true
}

export async function deleteRequirementExampleAssetIfUnreferenced(
  asset: Pick<RequirementExampleAsset, "publicId"> | { publicId?: string | null }
) {
  if (!asset.publicId) {
    return false
  }

  const [templateCount, transactionCount] = await Promise.all([
    prisma.checklistItem.count({
      where: { exampleImagePublicId: asset.publicId },
    }),
    prisma.transactionRequirement.count({
      where: { exampleImagePublicId: asset.publicId },
    }),
  ])

  if (templateCount > 0 || transactionCount > 0) {
    return false
  }

  return destroyRequirementExampleCloudinaryAsset(asset)
}

export function normalizeRequirementExampleImage(
  input: RequirementExampleImageInput,
  type: RequirementType,
  vendorId: string
) {
  if (type === RequirementType.TEXT) {
    return {
      exampleImageUrl: null,
      exampleImagePublicId: null,
      exampleImageFileName: null,
    }
  }

  const exampleImageUrl = typeof input.exampleImageUrl === "string" && input.exampleImageUrl.trim().length > 0
    ? input.exampleImageUrl.trim()
    : null
  const exampleImagePublicId =
    typeof input.exampleImagePublicId === "string" && input.exampleImagePublicId.trim().length > 0
      ? input.exampleImagePublicId.trim()
      : null
  const exampleImageFileName =
    typeof input.exampleImageFileName === "string" && input.exampleImageFileName.trim().length > 0
      ? input.exampleImageFileName.trim()
      : null

  if (!exampleImageUrl && !exampleImagePublicId && !exampleImageFileName) {
    return {
      exampleImageUrl: null,
      exampleImagePublicId: null,
      exampleImageFileName: null,
    }
  }

  if (!exampleImageUrl || !exampleImagePublicId) {
    throw new Error("Example image metadata is incomplete.")
  }

  if (!isVendorRequirementExamplePublicIdOwnedByVendor(exampleImagePublicId, vendorId)) {
    throw new Error("Example image upload is invalid for this vendor.")
  }

  if (!isCloudinaryAssetUrl(exampleImageUrl)) {
    throw new Error("Example image URL is invalid.")
  }

  const descriptor = extractCloudinaryAssetDescriptor(exampleImageUrl, exampleImageFileName)

  if (!descriptor || descriptor.resourceType !== "image") {
    throw new Error("Example image asset must be an image upload.")
  }

  return {
    exampleImageUrl,
    exampleImagePublicId,
    exampleImageFileName,
  }
}
