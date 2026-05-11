import { NextResponse } from "next/server"

import { requireVendorProfileAccess } from "@/lib/auth/guards"
import { prisma } from "@/lib/db/prisma"
import { cloudinary } from "@/lib/integrations/cloudinary"
import { extractCloudinaryAssetDescriptor } from "@/lib/integrations/cloudinary-assets"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const { vendorProfile } = await requireVendorProfileAccess()

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        vendorId: vendorProfile.id,
      },
      select: {
        contractArtifact: {
          select: {
            signatureImagePublicId: true,
            signatureImageUrl: true,
          },
        },
      },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, message: "Transaction not found." }, { status: 404 })
    }

    const artifact = transaction.contractArtifact

    if (!artifact?.signatureImagePublicId && !artifact?.signatureImageUrl) {
      return NextResponse.json({ success: false, message: "Signature image not found." }, { status: 404 })
    }

    const descriptor = extractCloudinaryAssetDescriptor(artifact.signatureImageUrl)

    if (descriptor && descriptor.resourceType !== "image") {
      return NextResponse.json(
        { success: false, message: "Stored signature image is not a previewable image asset." },
        { status: 404 }
      )
    }

    const publicId = artifact.signatureImagePublicId ?? descriptor?.publicId

    if (!publicId) {
      return NextResponse.json({ success: false, message: "Signature image not found." }, { status: 404 })
    }

    const previewUrl = cloudinary.utils.private_download_url(publicId, descriptor?.format ?? "png", {
      resource_type: "image",
      type: "upload",
      attachment: false,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
    })

    return NextResponse.redirect(previewUrl, { status: 302 })
  } catch (error) {
    console.error("Vendor signature image preview failed", error)
    return NextResponse.json(
      { success: false, message: "Unable to prepare the signature preview." },
      { status: 500 }
    )
  }
}
