const CLOUDINARY_HOST_FRAGMENT = ".cloudinary.com"
const CLOUDINARY_UPLOAD_SEGMENT = "/upload/"
const VERSION_SEGMENT = /^v\d+$/

export type CloudinaryResourceType = "image" | "raw" | "video"

type CloudinaryAssetDescriptor = {
  publicId: string
  resourceType: CloudinaryResourceType
  format: string
}

function normalizeLower(value: string | null | undefined) {
  return typeof value === "string" ? value.toLowerCase() : ""
}

export function isCloudinaryAssetUrl(url: string | null | undefined) {
  return typeof url === "string" && url.includes(CLOUDINARY_HOST_FRAGMENT) && url.includes(CLOUDINARY_UPLOAD_SEGMENT)
}

export function isPdfAssetUrl(url: string | null | undefined, fileName?: string | null) {
  const normalizedUrl = normalizeLower(url)
  const normalizedFileName = normalizeLower(fileName)

  return (
    normalizedUrl.includes(".pdf") ||
    normalizedUrl.includes("/raw/upload/") ||
    normalizedFileName.endsWith(".pdf")
  )
}

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

function inferFormat(lastPathSegment: string, fileName?: string | null) {
  const normalizedFileName = normalizeLower(fileName)
  const dotIndex = lastPathSegment.lastIndexOf(".")

  if (dotIndex > 0) {
    return lastPathSegment.slice(dotIndex + 1).toLowerCase()
  }

  if (normalizedFileName.includes(".")) {
    return normalizedFileName.slice(normalizedFileName.lastIndexOf(".") + 1)
  }

  return "pdf"
}

export function extractCloudinaryAssetDescriptor(url: string | null | undefined, fileName?: string | null): CloudinaryAssetDescriptor | null {
  if (!url || !isCloudinaryAssetUrl(url)) {
    return null
  }

  try {
    const parsed = new URL(url)
    const pathSegments = parsed.pathname.split("/").filter(Boolean)
    const resourceTypeIndex = pathSegments.findIndex((segment) => segment === "image" || segment === "raw" || segment === "video")

    if (resourceTypeIndex < 0 || pathSegments[resourceTypeIndex + 1] !== "upload") {
      return null
    }

    const resourceType = pathSegments[resourceTypeIndex] as CloudinaryResourceType
    let deliverySegments = pathSegments.slice(resourceTypeIndex + 2)
    const versionIndex = deliverySegments.findIndex((segment) => VERSION_SEGMENT.test(segment))

    if (versionIndex >= 0) {
      deliverySegments = deliverySegments.slice(versionIndex + 1)
    }

    if (deliverySegments.length === 0) {
      return null
    }

    const lastSegment = deliverySegments[deliverySegments.length - 1]
    const format = inferFormat(lastSegment, fileName)
    const dotIndex = lastSegment.lastIndexOf(".")
    const publicIdSegments = [
      ...deliverySegments.slice(0, -1),
      resourceType === "raw"
        ? lastSegment
        : dotIndex > 0
          ? lastSegment.slice(0, dotIndex)
          : lastSegment,
    ]

    return {
      publicId: publicIdSegments.join("/"),
      resourceType,
      format,
    }
  } catch {
    return null
  }
}

export function buildProtectedCloudinaryDownloadUrl(
  url: string | null | undefined,
  fileName?: string | null,
  baseUrl?: string
) {
  if (!url) {
    return null
  }

  if (!isPdfAssetUrl(url, fileName)) {
    return url
  }

  const descriptor = extractCloudinaryAssetDescriptor(url, fileName)

  if (!descriptor) {
    return url
  }

  const params = new URLSearchParams({
    publicId: descriptor.publicId,
    resourceType: descriptor.resourceType,
    format: descriptor.format,
  })

  if (fileName) {
    params.set("fileName", fileName)
  }

  const path = `/api/integrations/cloudinary/download?${params.toString()}`

  if (!baseUrl) {
    return path
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`
}

export function resolveDocumentAssetUrl(
  url: string | null | undefined,
  fileName?: string | null,
  baseUrl?: string
) {
  return buildProtectedCloudinaryDownloadUrl(url, fileName, baseUrl)
}
