import { requirePartnerBooking } from "@/features/partner-api/server/partner-bookings"
import { requirePartnerApiKey } from "@/lib/auth/partner-api"
import { prisma } from "@/lib/db/prisma"
import { cloudinary } from "@/lib/integrations/cloudinary"
import { extractCloudinaryAssetDescriptor } from "@/lib/integrations/cloudinary-assets"
import { PartnerApiError, withPartnerApi } from "@/lib/partner-api/errors"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * The signed agreement as a PDF (scope `bookings:read`), for the partner to hand it to its customer (LOCAZ QA V-08:
 * the signed contract in the customer's account). 404 until the customer has signed.
 */
export const GET = withPartnerApi<{ id: string }>(async (request, { params, requestId }) => {
  const { vendorProfile } = await requirePartnerApiKey(request, "bookings:read", { requestId })
  const { id } = await params
  const booking = await requirePartnerBooking(vendorProfile.id, { id })
  const artifact = await prisma.transactionContractArtifact.findUnique({ where: { transactionId: booking.id }, select: { signedPdfUrl: true, signedAt: true } })
  if (!artifact?.signedPdfUrl || !artifact.signedAt) {
    throw new PartnerApiError("not_found", "This agreement has not been signed yet.")
  }

  // The PDF is stored privately: read through a short-lived signed URL, never handed out.
  const descriptor = extractCloudinaryAssetDescriptor(artifact.signedPdfUrl, "signed.pdf")
  const source = descriptor
    ? cloudinary.utils.private_download_url(descriptor.publicId, descriptor.format, {
        resource_type: descriptor.resourceType as "image" | "raw" | "video",
        type: "upload",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      })
    : artifact.signedPdfUrl
  const pdf = await fetch(source)
  if (!pdf.ok) {
    throw new PartnerApiError("internal_error", "The signed agreement could not be read. Try again in a moment.")
  }

  return new Response(await pdf.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${(booking.externalRef ?? booking.reference ?? booking.id).replace(/[^\w.-]+/g, "-")}-contrat-signe.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
})
