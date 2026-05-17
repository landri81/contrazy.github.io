import { cloudinary } from "@/lib/integrations/cloudinary"
import { prisma } from "@/lib/db/prisma"
import { extractCloudinaryAssetDescriptor } from "@/lib/integrations/cloudinary-assets"
import {
  extractContractImageSources,
  type ContractTemplateInlineImageAsset,
  isVendorContractInlineImagePublicIdOwnedByVendor,
} from "@/features/contracts/contract-template-inline-assets"

export function assertValidVendorContractTemplateInlineImages(
  content: string,
  vendorId: string
) {
  for (const src of extractContractImageSources(content)) {
    const descriptor = extractCloudinaryAssetDescriptor(src)

    if (!descriptor || descriptor.resourceType !== "image") {
      throw new Error("Only uploaded contract images are allowed in templates.")
    }

    if (!isVendorContractInlineImagePublicIdOwnedByVendor(descriptor.publicId, vendorId)) {
      throw new Error("Contract image uploads are invalid for this vendor.")
    }
  }
}

export async function destroyContractTemplateInlineImageAsset(
  asset: Pick<ContractTemplateInlineImageAsset, "publicId"> | { publicId?: string | null }
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

export async function deleteContractTemplateInlineImageIfUnreferenced(
  publicId: string,
  options?: { ignoreTemplateId?: string | null }
) {
  const [templateCount, artifactCount] = await Promise.all([
    prisma.contractTemplate.count({
      where: {
        ...(options?.ignoreTemplateId ? { id: { not: options.ignoreTemplateId } } : {}),
        content: { contains: publicId },
      },
    }),
    prisma.transactionContractArtifact.count({
      where: {
        OR: [
          { templateContentSnapshot: { contains: publicId } },
          { renderedContentBeforeSignature: { contains: publicId } },
          { renderedContentAfterSignature: { contains: publicId } },
        ],
      },
    }),
  ])

  if (templateCount > 0 || artifactCount > 0) {
    return false
  }

  return destroyContractTemplateInlineImageAsset({ publicId })
}
